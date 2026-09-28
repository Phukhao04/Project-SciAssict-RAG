import json
import logging
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.orm import Session

from .embedding import embed_query
from .chunk_heading import extract_chunk_heading

logger = logging.getLogger(__name__)

# รัศมี chunk_id ที่จะมองหา "เศษที่เหลือ" ของ heading เดียวกัน - เผื่อไว้พอ
# สำหรับ heading ที่เนื้อหายาวจน max_chars (1500) ตัดเป็นหลาย chunk ติดกัน
SIBLING_SEARCH_RADIUS = 5


@dataclass
class RetrievedChunk:
    chunk_id: int
    chunk_text: str
    parent_text: str
    document_id: int
    document_name: str
    file_name: str | None
    source_url: str | None
    distance: float
    match_type: str = "vector"  # "vector" = มาจาก similarity search ตรงๆ, "sibling" = ถูกดึงมาเสริมเพราะ heading เดียวกันกับ chunk ที่ match


def _fetch_sibling_chunks(
    db: Session, document_id: int, center_chunk_id: int, heading: str
) -> list:
    """
    ดึง chunk ที่ chunk_id อยู่ในรัศมี SIBLING_SEARCH_RADIUS ของเอกสาร
    เดียวกัน แล้วกรองเฉพาะอันที่ extract heading ออกมาแล้วตรงกับ heading
    ของ chunk ศูนย์กลางเป๊ะ

    ใช้จับกรณี: เนื้อหาใต้ heading เดียวกันยาวเกิน max_chars ตอน ingest
    (ดู build_chunks_from_marks ใน ingest_manual.py) เลยถูกตัดเป็นหลาย
    chunk แยกกันใน DB - ถ้า vector search เจอแค่ชิ้นเดียว LLM จะเห็น
    เนื้อหาไม่ครบ คำตอบขาดหายโดยไม่รู้ตัว
    """
    sql = text("""
        SELECT chunk_id, chunk_text, parent_text
        FROM document_chunk
        WHERE document_id = :document_id
          AND chunk_id BETWEEN :lo AND :hi
        ORDER BY chunk_id ASC
    """)
    rows = db.execute(
        sql,
        {
            "document_id": document_id,
            "lo": center_chunk_id - SIBLING_SEARCH_RADIUS,
            "hi": center_chunk_id + SIBLING_SEARCH_RADIUS,
        },
    ).fetchall()

    return [
        row
        for row in rows
        if row.chunk_id != center_chunk_id
        and extract_chunk_heading(row.parent_text, row.chunk_text) == heading
    ]


def retrieve(db: Session, query_text_str: str, k: int = 5) -> list[RetrievedChunk]:
    """
    คืนค่า chunk ที่เกี่ยวข้องกับคำถาม ด้วย vector search (cosine distance)
    เป็นหลัก แล้วเสริมด้วย chunk ข้างเคียงที่มี heading เดียวกัน (sibling
    expansion) เพื่อรวมเนื้อหาที่ถูกตัดแบ่งเพราะเกิน max_chars ตอน ingest
    ให้ครบก่อนส่งเข้า LLM
    """
    query_embedding = embed_query(query_text_str)

    sql = text("""
        SELECT
            dc.chunk_id,
            dc.chunk_text,
            dc.parent_text,
            dc.document_id,
            d.document_name,
            d.file_name,
            d.source_url,
            vec_cosine_distance(dc.embedding_vector, :query_embedding) AS distance
        FROM document_chunk dc
        JOIN document d
            ON dc.document_id = d.document_id
        ORDER BY distance
        LIMIT :k
    """)

    rows = db.execute(
        sql,
        {
            "query_embedding": json.dumps(query_embedding),
            "k": k,
        },
    ).fetchall()

    # ใช้ dict คีย์ด้วย chunk_id กันซ้ำ ระหว่าง top-k เดิมกับ sibling ที่ดึงมาเสริม
    results: dict[int, RetrievedChunk] = {
        row.chunk_id: RetrievedChunk(
            chunk_id=row.chunk_id,
            chunk_text=row.chunk_text,
            parent_text=row.parent_text,
            document_id=row.document_id,
            document_name=row.document_name,
            file_name=row.file_name,
            source_url=row.source_url,
            distance=row.distance,
            match_type="vector",
        )
        for row in rows
    }

    for row in rows:
        heading = extract_chunk_heading(row.parent_text, row.chunk_text)
        if not heading:
            continue  # chunk นี้ไม่มี heading กำกับ (เช่นเนื้อหาก่อนหัวข้อแรกของเอกสาร) ไม่มีทางหา sibling ได้

        for sib in _fetch_sibling_chunks(db, row.document_id, row.chunk_id, heading):
            if sib.chunk_id in results:
                continue
            results[sib.chunk_id] = RetrievedChunk(
                chunk_id=sib.chunk_id,
                chunk_text=sib.chunk_text,
                parent_text=sib.parent_text,
                document_id=row.document_id,
                document_name=row.document_name,
                file_name=row.file_name,
                source_url=row.source_url,
                distance=row.distance,  # ใช้ distance ของ chunk ต้นทางที่ match จริง เพราะ sibling เองไม่ได้ผ่าน vector search
                match_type="sibling",
            )

    # เรียงตามลำดับจริงในเอกสาร (document_id, chunk_id) แทนการเรียงตาม
    # distance เดิม - กันไม่ให้ส่วนที่ 2 ของ heading เดียวกันโผล่ก่อนส่วนที่ 1
    # ใน prompt ซึ่งจะทำให้ LLM อ่านเนื้อหาสลับลำดับกัน
    return sorted(results.values(), key=lambda c: (c.document_id, c.chunk_id))