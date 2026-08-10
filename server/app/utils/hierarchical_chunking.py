import re
from dataclasses import dataclass


@dataclass
class ParentChunk:
    text: str
    parent_index: int
    path: tuple  # เส้นทางหัวข้อ เช่น ("บทที่ 1 บทนำ", "1.1 ความเป็นมา")


@dataclass
class ChildChunk:
    text: str
    child_index: int
    parent_index: int  # ผูกกลับไปหา ParentChunk.parent_index
    path: tuple


# ตัวคั่นระหว่าง cell ในแถวตาราง (ต้องตรงกับที่ extraction.py ใช้ตอน
# join cell ในแถวเดียวกัน) เลือกอักขระนี้เพราะแทบไม่มีทางปรากฏในเนื้อหา
# จริงโดยบังเอิญ - ใช้เป็น "ป้ายบอก" ว่าบรรทัดนี้มาจากแถวตาราง ไม่ใช่ prose
ROW_MARKER = "┃"


# ---------- Recursive splitter (ตัวสำรอง/ตัวตัดย่อย สำหรับ prose) ----------


def _split_sentences(text: str) -> list[str]:
    """แบ่งข้อความเป็นประโยคย่อย (หน่วยเล็กสุดที่ยอมตัด ไม่ตัดกลางประโยค)"""
    text = text.strip()
    rough = re.split(r"\n+|\s{2,}", text)
    sentences = []
    for part in rough:
        part = part.strip()
        if not part:
            continue
        sentences.extend(
            s.strip() for s in re.split(r"(?<=[.!?ฯ])\s+", part) if s.strip()
        )
    return sentences


def _pack_units(
    units: list[str], max_chars: int, overlap_chars: int, joiner: str = " "
) -> list[str]:
    """รวม 'หน่วยข้อความ' เข้าด้วยกันจนใกล้ max_chars แล้วเว้น overlap ให้ก้อนถัดไป"""
    pieces: list[str] = []
    current: list[str] = []
    current_len = 0

    for unit in units:
        u_len = len(unit)

        if u_len > max_chars:
            if current:
                pieces.append(joiner.join(current))
                current, current_len = [], 0
            pieces.append(unit)
            continue

        if current and current_len + u_len > max_chars:
            pieces.append(joiner.join(current))

            overlap_units, acc = [], 0
            for u in reversed(current):
                if acc >= overlap_chars:
                    break
                overlap_units.insert(0, u)
                acc += len(u)

            if acc + u_len > max_chars:
                current, current_len = [], 0
            else:
                current, current_len = overlap_units, acc

        current.append(unit)
        current_len += u_len

    if current:
        pieces.append(joiner.join(current))

    return pieces


def _hard_split(text: str, max_chars: int, overlap_chars: int) -> list[str]:
    """ตัวสำรองสุดท้าย: ตัดตรงตามจำนวนตัวอักษรเป๊ะๆ"""
    step = max(max_chars - overlap_chars, 1)
    return [text[i : i + max_chars] for i in range(0, len(text), step)]


def recursive_split(
    text: str, max_chars: int = 500, overlap_chars: int = 75
) -> list[str]:
    sentences = _split_sentences(text)
    if not sentences:
        return []

    packed = _pack_units(sentences, max_chars, overlap_chars, joiner=" ")

    final_pieces: list[str] = []
    for piece in packed:
        if len(piece) <= max_chars:
            final_pieces.append(piece)
            continue

        words = piece.split(" ")
        word_packed = _pack_units(words, max_chars, overlap_chars, joiner=" ")

        for wp in word_packed:
            if len(wp) <= max_chars:
                final_pieces.append(wp)
            else:
                final_pieces.extend(_hard_split(wp, max_chars, overlap_chars))

    return final_pieces


# ---------- ตัวตัดใหม่ (v4): เคารพขอบเขตแถวตาราง ห้ามผสมข้าม record ----------


def _split_row_line(line: str, max_chars: int, overlap_chars: int) -> list[str]:
    cells = [c.strip() for c in line.split(ROW_MARKER) if c.strip()]
    if not cells:
        return []

    packed = _pack_units(cells, max_chars, overlap_chars, joiner=f" {ROW_MARKER} ")

    final: list[str] = []
    for piece in packed:
        if len(piece) <= max_chars:
            final.append(piece)
        else:
            final.extend(recursive_split(piece, max_chars, overlap_chars))
    return final


def _split_preserving_rows(text: str, max_chars: int, overlap_chars: int) -> list[str]:
    lines = text.split("\n")
    units: list[str] = []
    prose_buffer: list[str] = []

    def flush_prose_buffer():
        if not prose_buffer:
            return
        joined = "\n".join(prose_buffer)
        units.extend(recursive_split(joined, max_chars, overlap_chars))
        prose_buffer.clear()

    for line in lines:
        if ROW_MARKER in line:
            if prose_buffer:
                pending = "\n".join(prose_buffer)
                combined = f"{pending}\n{line}"
                if len(combined) <= max_chars:
                    units.append(combined)
                    prose_buffer.clear()
                    continue
                flush_prose_buffer()

            if len(line) <= max_chars:
                units.append(line)
            else:
                units.extend(_split_row_line(line, max_chars, overlap_chars))
        else:
            if line.strip():
                prose_buffer.append(line)

    flush_prose_buffer()
    return units


# ---------- ขั้นที่ 1: แบ่งตาม Heading Style จริงจาก Word เป็น "section" ดิบๆ ก่อน ----------


def _split_into_sections(
    paragraphs: list[tuple[int | None, str]],
) -> list[tuple[tuple, str]]:
    """ไล่ทีละ (level, text) เจอ heading ระดับไหน ก็ปิด section เดิม เริ่ม section ใหม่"""
    current_path: dict[int, str] = {}
    current_body: list[str] = []
    sections: list[tuple[tuple, str]] = []

    def path_tuple() -> tuple:
        return tuple(current_path[lvl] for lvl in sorted(current_path))

    def flush():
        if current_body:
            sections.append((path_tuple(), "\n".join(current_body)))
        current_body.clear()

    for level, text in paragraphs:
        if level is not None:
            flush()
            for lvl in list(current_path.keys()):
                if lvl >= level:
                    del current_path[lvl]
            current_path[level] = text
            continue

        current_body.append(text)

    flush()
    return sections


# ---------- ขั้นที่ 2 + 3: สร้าง Parent chunks แล้วตัดซ้ำเป็น Child chunks ----------


def chunk_by_headings_parent_child(
    paragraphs: list[tuple[int | None, str]],
    parent_max_chars: int = 1200,
    parent_overlap_chars: int = 100,
    child_max_chars: int = 400,
    child_overlap_chars: int = 30,
    header_prefix: str = "",
) -> tuple[list[ParentChunk], list[ChildChunk]]:

    # ---- สร้าง Parent chunks ----
    parents: list[ParentChunk] = []
    parent_idx = 0

    for path, body in sections:
        if not body:
            continue

        path_str = " > ".join(path)
        prefix_parts = [p for p in [header_prefix, path_str] if p]
        prefix = " | ".join(prefix_parts)

        candidate = f"{prefix}\n{body}" if prefix else body

        if len(candidate) <= parent_max_chars:
            parents.append(ParentChunk(candidate, parent_idx, path))
            parent_idx += 1
        else:
            budget = max(parent_max_chars - len(prefix) - 1, 200)
            sub_pieces = _split_preserving_rows(
                body, max_chars=budget, overlap_chars=parent_overlap_chars
            )
            for piece in sub_pieces:
                full_text = f"{prefix}\n{piece}" if prefix else piece
                parents.append(ParentChunk(full_text, parent_idx, path))
                parent_idx += 1

    # ---- สร้าง Child chunks ----
    children: list[ChildChunk] = []
    child_idx = 0

    for parent in parents:
        if len(parent.text) <= child_max_chars:
            children.append(
                ChildChunk(parent.text, child_idx, parent.parent_index, parent.path)
            )
            child_idx += 1
            continue

        sub_pieces = _split_preserving_rows(
            parent.text, max_chars=child_max_chars, overlap_chars=child_overlap_chars
        )
        for piece in sub_pieces:
            children.append(
                ChildChunk(piece, child_idx, parent.parent_index, parent.path)
            )
            child_idx += 1

    return parents, children