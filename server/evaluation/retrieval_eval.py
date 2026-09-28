"""
Retrieval evaluation — วัดคุณภาพ retrieval ล้วนๆ (ไม่เรียก LLM)

วิธีรัน (จากโฟลเดอร์ server/ เพราะ config อ่าน .env จาก cwd):
    python -m evaluation.retrieval_eval
    python -m evaluation.retrieval_eval --k 5 --ks 1,3,5,10
    python -m evaluation.retrieval_eval --ignore-program     # ไม่บังคับว่าต้องมาจากสาขาที่ถามเท่านั้น

ground truth ทำงานยังไง
- ไม่ใช้ chunk_id (เปลี่ยนทุกครั้งที่ ingest ใหม่) แต่ใช้ "keyword ที่ต้องอยู่ใน parent_text"
- chunk จะนับว่า relevant ถ้ามี relevant_keywords ครบทุกตัว
  (และถ้าใส่ program_hint ต้องอยู่ในเอกสารที่ชื่อมี program_hint ด้วย)
- สคริปต์สแกนทั้งตาราง document_chunk หนึ่งครั้ง เพื่อรู้ว่า "chunk ที่ถูกต้องทั้งหมด" มีกี่อัน
  → คำนวณ Recall / nDCG ได้ถูกต้อง และเตือนถ้าคำถามไหน keyword ไม่ match chunk ไหนเลย

metric สองชุด
1) Rank metrics (Hit@k, MRR, Precision@k, Recall@k, nDCG@k)
   ใช้เฉพาะ chunk ที่มาจาก vector search จริง เรียงตาม distance
   (retrieve() คืน sibling ปนมาและเรียงตามลำดับในเอกสาร ไม่ใช่ตาม rank จึงต้องแยกออกมาคิด)
2) Context metrics (สิ่งที่ LLM เห็นจริงที่ k ปกติ รวม sibling)
   - context hit      : มี chunk ที่ถูกต้องอย่างน้อย 1 อัน
   - keyword coverage : สัดส่วน coverage_keywords ที่อยู่ใน context (ใช้วัดคำถามแบบ list)
   - program purity   : สัดส่วน chunk ที่มาจากสาขาที่ถาม
"""

import argparse
import csv
import json
import math
import re
import sys
import time
import unicodedata
from datetime import datetime
from pathlib import Path

from sqlalchemy import text

from app.db.session import SessionLocal
from app.utils.retrieval import retrieve

HERE = Path(__file__).parent
_STRIP = re.compile(r"[\s|\u200b\u200c\u200d\ufeff]+")


def norm(s: str | None) -> str:
    """ตัดช่องว่าง/pipe (ที่มาจากตาราง) แล้ว lower — ทั้งฝั่ง keyword และฝั่ง chunk"""
    s = unicodedata.normalize("NFKC", s or "")
    return _STRIP.sub("", s).lower()


def load_golden(path: str) -> list[dict]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return data["questions"]


def load_corpus(db) -> list[dict]:
    rows = db.execute(
        text("""
            SELECT dc.chunk_id, dc.parent_text, d.document_name
            FROM document_chunk dc
            JOIN document d ON dc.document_id = d.document_id
        """)
    ).fetchall()
    return [
        {"chunk_id": r.chunk_id, "text": norm(r.parent_text), "doc": norm(r.document_name)}
        for r in rows
    ]


def is_relevant(chunk_text_n: str, doc_n: str, kws: list[str], hint: str | None) -> bool:
    if hint and hint not in doc_n:
        return False
    return all(k in chunk_text_n for k in kws)


def ranked_vector(db, question: str, max_k: int) -> list:
    chunks = retrieve(db, question, k=max_k)
    vec = [c for c in chunks if c.match_type == "vector"]
    vec.sort(key=lambda c: (c.distance, c.chunk_id))
    return vec


def ndcg_at_k(flags: list[bool], total_rel: int, k: int) -> float:
    dcg = sum(1 / math.log2(i + 2) for i, f in enumerate(flags[:k]) if f)
    ideal = sum(1 / math.log2(i + 2) for i in range(min(total_rel, k)))
    return dcg / ideal if ideal else 0.0


def mean(values: list) -> float | None:
    vals = [v for v in values if v is not None]
    return sum(vals) / len(vals) if vals else None


def fmt(v: float | None, digits: int = 3) -> str:
    return "-" if v is None else f"{v:.{digits}f}"


def preview(c, width: int = 70) -> str:
    body = c.parent_text.replace("\n", " / ")
    return f"[{c.document_name[:28]}] {body[:width]}"


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # กัน Windows console พิมพ์ไทยพัง
    except Exception:
        pass

    ap = argparse.ArgumentParser()
    ap.add_argument("--golden", default=str(HERE / "golden_set.json"))
    ap.add_argument("--k", type=int, default=5, help="k ที่ใช้จริงตอนแชท (context metrics)")
    ap.add_argument("--ks", default="1,3,5,10", help="k ที่ใช้รายงาน rank metrics")
    ap.add_argument("--ignore-program", action="store_true")
    ap.add_argument("--no-save", action="store_true")
    args = ap.parse_args()

    ks = sorted({int(x) for x in args.ks.split(",")} | {args.k})
    max_k = max(ks)
    questions = load_golden(args.golden)

    db = SessionLocal()
    rows: list[dict] = []
    missing: list[dict] = []
    failures: list[tuple[dict, list, int | None]] = []

    try:
        corpus = load_corpus(db)
        print(f"corpus: {len(corpus)} chunks | golden set: {len(questions)} questions\n")

        for q in questions:
            kws = [norm(k) for k in q["relevant_keywords"]]
            hint = None if args.ignore_program else (norm(q.get("program_hint")) or None)

            rel_ids = {
                c["chunk_id"] for c in corpus if is_relevant(c["text"], c["doc"], kws, hint)
            }
            if not rel_ids:
                missing.append(q)
                continue

            t0 = time.perf_counter()
            vec = ranked_vector(db, q["question"], max_k)
            ctx = retrieve(db, q["question"], k=args.k)
            latency_ms = (time.perf_counter() - t0) * 1000

            flags = [c.chunk_id in rel_ids for c in vec]
            first_rank = next((i + 1 for i, f in enumerate(flags) if f), None)

            row = {
                "id": q["id"],
                "type": q.get("type", "-"),
                "question": q["question"],
                "n_relevant_in_corpus": len(rel_ids),
                "first_relevant_rank": first_rank,
                "mrr": (1 / first_rank) if first_rank else 0.0,
                "latency_ms": round(latency_ms, 1),
            }
            for k in ks:
                top = flags[:k]
                row[f"hit@{k}"] = 1.0 if any(top) else 0.0
                row[f"precision@{k}"] = sum(top) / k
                row[f"recall@{k}"] = sum(top) / len(rel_ids)
                row[f"ndcg@{k}"] = ndcg_at_k(flags, len(rel_ids), k)

            # ---- context metrics (สิ่งที่ LLM เห็นจริง) ----
            row["ctx_hit"] = 1.0 if any(c.chunk_id in rel_ids for c in ctx) else 0.0
            row["ctx_size"] = len(ctx)
            row["ctx_siblings"] = sum(1 for c in ctx if c.match_type == "sibling")

            cov_kws = [norm(x) for x in q.get("coverage_keywords", [])]
            if cov_kws:
                ctx_text = "".join(norm(c.parent_text) for c in ctx)
                row["ctx_coverage"] = sum(1 for k in cov_kws if k in ctx_text) / len(cov_kws)
            else:
                row["ctx_coverage"] = None

            prog = norm(q.get("program_hint"))
            if prog and ctx:
                row["program_purity"] = sum(1 for c in ctx if prog in norm(c.document_name)) / len(ctx)
            else:
                row["program_purity"] = None

            rows.append(row)
            if not any(flags[: args.k]):
                failures.append((q, vec, first_rank))
    finally:
        db.close()

    # ---------- รายงาน ----------
    if missing:
        print(f"!! ground truth ไม่ match chunk ไหนเลย {len(missing)} ข้อ (ตัดออกจากการคำนวณ)")
        print("   → เช็ค relevant_keywords / program_hint หรือลองรันด้วย --ignore-program")
        for q in missing:
            print(f"   - {q['id']}: {q['question']}")
        print()

    if not rows:
        print("ไม่มีคำถามที่ใช้คำนวณได้ — หยุด")
        return

    print(f"=== Retrieval metrics (n={len(rows)}) — vector ranking ===")
    print(f"{'k':>3} {'Hit@k':>8} {'Prec@k':>8} {'Recall@k':>9} {'nDCG@k':>8}")
    for k in ks:
        print(
            f"{k:>3} "
            f"{fmt(mean([r[f'hit@{k}'] for r in rows])):>8} "
            f"{fmt(mean([r[f'precision@{k}'] for r in rows])):>8} "
            f"{fmt(mean([r[f'recall@{k}'] for r in rows])):>9} "
            f"{fmt(mean([r[f'ndcg@{k}'] for r in rows])):>8}"
        )
    print(f"MRR@{max_k}: {fmt(mean([r['mrr'] for r in rows]))}\n")

    print(f"=== Context ที่ LLM เห็นจริง (k={args.k} + sibling) ===")
    print(f"context hit      : {fmt(mean([r['ctx_hit'] for r in rows]))}")
    cov = [r["ctx_coverage"] for r in rows]
    print(f"keyword coverage : {fmt(mean(cov))}  (n={sum(1 for c in cov if c is not None)})")
    print(f"program purity   : {fmt(mean([r['program_purity'] for r in rows]))}")
    print(f"avg chunks → LLM : {fmt(mean([r['ctx_size'] for r in rows]), 1)} "
          f"(sibling {fmt(mean([r['ctx_siblings'] for r in rows]), 1)})")
    print(f"avg latency      : {fmt(mean([r['latency_ms'] for r in rows]), 0)} ms\n")

    print(f"=== แยกตามประเภทคำถาม (Hit@{args.k} / MRR / ctx coverage) ===")
    for t in sorted({r["type"] for r in rows}):
        sub = [r for r in rows if r["type"] == t]
        print(
            f"{t:<12} n={len(sub):<3} "
            f"Hit@{args.k}={fmt(mean([r[f'hit@{args.k}'] for r in sub]))}  "
            f"MRR={fmt(mean([r['mrr'] for r in sub]))}  "
            f"cov={fmt(mean([r['ctx_coverage'] for r in sub]))}"
        )
    print()

    if failures:
        print(f"=== พลาดที่ top-{args.k} ({len(failures)} ข้อ) ===")
        for q, vec, first_rank in failures:
            where = f"เจอที่อันดับ {first_rank}" if first_rank else f"ไม่เจอใน top-{max_k}"
            print(f"- {q['id']} [{q.get('type','-')}] {q['question']}  ({where})")
            for i, c in enumerate(vec[:3], 1):
                print(f"    {i}. d={c.distance:.3f} {preview(c)}")
        print()

    if not args.no_save:
        out_dir = HERE / "results"
        out_dir.mkdir(exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        json_path = out_dir / f"retrieval_{stamp}.json"
        csv_path = out_dir / f"retrieval_{stamp}.csv"

        summary = {
            "n": len(rows),
            "skipped_no_ground_truth": [q["id"] for q in missing],
            "operational_k": args.k,
            "mrr": mean([r["mrr"] for r in rows]),
            **{f"hit@{k}": mean([r[f"hit@{k}"] for r in rows]) for k in ks},
            **{f"precision@{k}": mean([r[f"precision@{k}"] for r in rows]) for k in ks},
            **{f"recall@{k}": mean([r[f"recall@{k}"] for r in rows]) for k in ks},
            **{f"ndcg@{k}": mean([r[f"ndcg@{k}"] for r in rows]) for k in ks},
            "ctx_hit": mean([r["ctx_hit"] for r in rows]),
            "ctx_coverage": mean(cov),
        }
        json_path.write_text(
            json.dumps({"summary": summary, "questions": rows}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        with csv_path.open("w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
        print(f"saved → {json_path.relative_to(HERE.parent)}")
        print(f"saved → {csv_path.relative_to(HERE.parent)}")


if __name__ == "__main__":
    main()