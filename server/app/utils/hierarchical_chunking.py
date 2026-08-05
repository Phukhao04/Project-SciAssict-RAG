"""
Header-based Parent-Child Chunking
====================================
v4: แก้ปัญหา "แถวตารางถูกผสมปนกันข้ามรายวิชา" ที่เจอจริงจากการทดสอบ
(308-232 ไปโดนดึงไปติดกับชื่อวิชาของ 308-331 เพราะทั้งคู่ถูก pack รวม
ก้อนเดียวกันตามจำนวนตัวอักษร โดยไม่สนว่าเป็นคนละ record/รายวิชากัน)

ต้นตอ: recursive_split() (ผ่าน _pack_units) ตัด/รวม "หน่วยข้อความ"
(ประโยค) เข้าด้วยกันตามจำนวนตัวอักษรล้วนๆ ไม่รู้จัก concept ของ "แถว
ตาราง 1 แถว = 1 record ที่ห้ามผสมกับ record อื่น" เลย เพราะเดิมออกแบบ
มาสำหรับ prose (ที่การ pack ประโยคติดกันเป็นเรื่องดี ให้บริบทมากขึ้น)
ไม่ได้ออกแบบมาสำหรับข้อมูลตาราง (ที่การ pack ข้าม record เป็นเรื่องเสีย)

ทางแก้ (v4): เพิ่ม _split_preserving_rows() เป็นตัวเลือกใหม่ที่ใช้แทน
recursive_split() เฉพาะตอนตัด parent และตัด child เท่านั้น (2 จุดที่
เดิมเรียก recursive_split ตรงๆ) กติกา:
    - บรรทัดที่มาจากแถวตาราง (ตรวจด้วย ROW_MARKER) -> เป็น 1 unit เดี่ยว
      เสมอ ห้ามถูกดึงไปรวมกับแถวตารางอื่น
    - บรรทัด prose ธรรมดา -> ยัง pack รวมกันได้ตามปกติ (ไม่กระทบ
      พฤติกรรมเดิมสำหรับเอกสารที่เป็นข้อความบรรยาย)
ไม่ต้องมี DB table ใหม่ ไม่ต้อง retrieval path ใหม่ - ยังใช้
ParentChunk/ChildChunk เดิมทั้งหมด แค่เปลี่ยนวิธี "ตัด" เท่านั้น

อ้างอิง: Anthropic - "Contextual Retrieval", Small-to-Big Retrieval
https://www.anthropic.com/engineering/contextual-retrieval
"""

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
    """ตัดข้อความ prose ยาวเป็นชิ้นขนาด ~max_chars ตัวอักษร (ใช้กับ prose เท่านั้น
    สำหรับเนื้อหาที่อาจมีแถวตารางปนอยู่ ใช้ _split_preserving_rows แทน)"""
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
    """
    ตัดแถวตาราง 1 แถว (ที่ยาวเกิน max_chars เดี่ยวๆ อยู่แล้ว) โดยตัดตาม
    ขอบเขต 'cell' (คั่นด้วย ROW_MARKER) เป็นหลัก ไม่ใช่โยนทั้งแถวเข้า
    recursive_split ตรงๆ (ซึ่งไม่รู้จัก ROW_MARKER เลย เสี่ยงตัดคร่อม
    กลาง cell/กลางคำได้ - เจอจริงจากการทดสอบ: "การโปรแกรมเชิงวัตถุ..."
    โดนตัดกลางคำ "วัตถุ" แล้วท่อนที่เหลือไปติดกับรหัสวิชาถัดไปแทน)

    วิธีทำ: แยกเป็น cell ก่อน (split ด้วย ROW_MARKER) แล้ว pack cell
    เข้าด้วยกันแบบเดียวกับ _pack_units ปกติ (จะได้ไม่ตัดคร่อมกลาง cell)
    ถ้า cell เดียวก็ยังยาวเกิน max_chars เอง (ชื่อวิชายาวมากจริงๆ)
    ค่อย fallback ไป recursive_split เฉพาะ cell นั้น cell เดียว
    (ยังไม่ปนกับ cell/วิชาอื่นอยู่ดี เพราะทำทีละ cell)
    """
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
    """
    เหมือน recursive_split แต่ 'ห้ามผสมหลายแถวตารางเข้าด้วยกันในก้อนเดียว'
    เด็ดขาด ใช้แทน recursive_split ทุกจุดที่เนื้อหาอาจมีแถวตารางปนอยู่

    กติกา:
    1. บรรทัดที่มี ROW_MARKER (แถวตาราง) -> เป็น 1 unit เดี่ยวเสมอ
    2. ถ้ามี prose ค้างอยู่ก่อนแถวตาราง (เช่น prefix บรรทัดแรก) และรวมกับ
       แถวตารางนี้แล้วยังไม่เกิน max_chars -> ผนวกเข้าด้วยกัน (กันไม่ให้
       prefix กลายเป็น chunk เดี่ยวๆ ที่ไม่มีเนื้อหาจริงอยู่ข้างใน)
    3. บรรทัด prose ล้วนๆ (ไม่มีแถวตารางมาคั่น) -> ยัง pack รวมกันได้ตาม
       recursive_split ปกติ ไม่กระทบพฤติกรรมเดิมสำหรับเอกสารที่เป็น
       ข้อความบรรยายทั้งหมด
    4. แถวตารางที่ยาวเกิน max_chars เดี่ยวๆ (นับแค่แถวนั้น ไม่รวมแถวอื่น)
       -> fallback ไป recursive_split เฉพาะแถวนั้นแถวเดียว (ยังไม่ปนกับ
       แถวอื่นอยู่ดี เพราะทำทีละแถว)
    """
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
    """
    paragraphs: list ของ (heading_level, text) จาก extraction.py

    v4: เปลี่ยนจากเรียก recursive_split() ตรงๆ มาเรียก _split_preserving_rows()
    แทนทั้ง 2 จุด (ตอนตัด parent ที่ section ยาวเกิน, ตอนตัด child ที่
    parent ยาวเกิน) เพื่อไม่ให้แถวตารางถูกผสมข้าม record กัน

    child_max_chars=400 (เดิม 200): ปรับจากข้อมูลจริง - เทอมที่มีวิชา
    เยอะสุดในเอกสารแผนการเรียนยาวแค่ ~317 ตัวอักษร ตั้ง 400 ทำให้แต่ละ
    เทอมกลายเป็น 1 child chunk เต็มๆ เสมอ (ไม่ตัดแยกเทอมเดียวเป็นหลาย
    chunk อีก) ยังเล็กพอสำหรับ embedding ที่โฟกัส เพราะ _split_preserving_rows
    ไม่ผสมหลายแถวเข้าด้วยกันอยู่ดีไม่ว่า max_chars จะตั้งเท่าไหร่
    """
    sections = _split_into_sections(paragraphs)

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