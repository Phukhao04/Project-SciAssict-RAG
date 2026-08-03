"""
Header-based Parent-Child Chunking
====================================
v3: เพิ่มชั้น "Parent-Child" ต่อยอดจาก v2 (header-based)

ปัญหาที่ v2 ยังมี: chunk 1 ก้อน ต้องทำหน้าที่ 2 อย่างพร้อมกัน
1. เป็นตัวแทนสำหรับ "ค้นหา" (embed แล้ววัด cosine similarity)
2. เป็น "เนื้อหา" ที่ส่งให้ LLM อ่านตอบคำถาม

ถ้า chunk เล็ก -> embed แม่น (โฟกัสเรื่องเดียว) แต่ LLM ได้บริบทไม่พอตอบ
ถ้า chunk ใหญ่ -> LLM มีบริบทพอ แต่ embed ปนหลายเรื่อง วัด similarity ไม่แม่น

วิธีแก้ (Small-to-Big / Parent-Child retrieval):
แยกหน้าที่ 2 อย่างออกจากกัน เก็บข้อมูล 2 ระดับ
- Parent: หน่วยใหญ่ (คือ section ใต้ heading หนึ่งๆ) -> เก็บไว้ "ให้ LLM อ่าน" ตอนตอบ
- Child : หน่วยเล็ก (ตัด parent ซ้ำอีกที) -> เอาไป "embed + ค้นหา" เท่านั้น

ตอน retrieve: ค้นด้วย child embedding (แม่น เพราะเล็กโฟกัส)
             แต่ส่ง parent.text กลับไปให้ LLM อ่าน (มีบริบทครบกว่า)

อ้างอิง: Anthropic - "Contextual Retrieval" แนวคิดเรื่องแยก unit สำหรับ index
กับ unit สำหรับ generation, และ Small-to-Big Retrieval (LlamaIndex/Vectara)
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


# ---------- Recursive splitter (ตัวสำรอง/ตัวตัดย่อย ใช้ร่วมกันทั้ง 2 ระดับ) ----------
# ส่วนนี้ไม่เปลี่ยนจาก v2 เลย ใช้ตรรกะเดียวกันทั้งตอนตัด parent และตอนตัด child
# (parent เรียกด้วย max_chars ก้อนใหญ่, child เรียกด้วย max_chars ก้อนเล็ก)


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
    """
    รวม 'หน่วยข้อความ' (ประโยคหรือคำ) เข้าด้วยกันจนใกล้ max_chars แล้วเว้น overlap ให้ก้อนถัดไป

    v3.2: แก้บั๊ก "ไม่เช็คซ้ำหลัง reset overlap" — เดิมพอ flush แล้วตั้ง current
    เป็น overlap ของก้อนก่อน จะ append unit ใหม่เข้าไปทันทีโดยไม่เช็คว่า
    overlap + unit ใหม่ ยังเกิน max_chars อยู่หรือเปล่า ทำให้บางก้อนบวมเกิน
    limit ไปเล็กน้อย แล้วไปโดน _hard_split (ตัดดิบตามตัวอักษร ไม่สนขอบเขตคำ)
    ที่ชั้นถัดไป ผลคือคำ/อีเมลถูกตัดขาดกลางคำได้ -> แก้โดยเช็คซ้ำหลัง reset:
    ถ้า overlap + unit ใหม่ยังเกิน max_chars อยู่ดี ให้ทิ้ง overlap ไปเลย
    (ยอมเสีย context ต่อเนื่องเล็กน้อย ดีกว่าปล่อยให้ก้อนบวมจนโดนตัดมั่ว)
    """
    pieces: list[str] = []
    current: list[str] = []
    current_len = 0

    for unit in units:
        u_len = len(unit)

        # หน่วยเดี่ยวยาวเกิน max_chars เอง (ประโยคไทยยาวไม่มีจุดคั่น) -> แยกเป็นก้อนเดี่ยว
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

            # เช็คซ้ำ: overlap + unit ใหม่ยังเกิน max_chars อยู่ดีมั้ย
            # ถ้าเกิน -> ทิ้ง overlap ทิ้งไปเลย เริ่มก้อนใหม่เปล่าๆ แทน
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
    """ตัดข้อความยาวเป็นชิ้นขนาด ~max_chars ตัวอักษร ไล่ระดับความละเอียดจากหยาบไปละเอียด (ไม่เปลี่ยนจาก v2)"""
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


# ---------- ขั้นที่ 1: แบ่งตาม Heading Style จริงจาก Word เป็น "section" ดิบๆ ก่อน ----------


def _split_into_sections(
    paragraphs: list[tuple[int | None, str]],
) -> list[tuple[tuple, str]]:
    """
    ไล่ทีละ (level, text) เจอ heading ระดับไหน ก็ปิด section เดิม เริ่ม section ใหม่
    รีเซ็ตหัวข้อของทุกระดับที่ "ลึกกว่าหรือเท่ากับ" ระดับที่เพิ่งเจอ
    (ย้ายมาจาก chunk_by_headings เดิมใน v2 เหมือนกันทุกอย่าง แค่แยกเป็นฟังก์ชันย่อย
    เพื่อให้เอาไปต่อกับขั้น parent/child ได้)
    """
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
    child_max_chars: int = 200,
    child_overlap_chars: int = 30,
    header_prefix: str = "",
) -> tuple[list[ParentChunk], list[ChildChunk]]:
    """
    paragraphs: list ของ (heading_level, text) จาก extraction.py เหมือนเดิมทุกประการ

    คืนค่าเป็น (parents, children) แยกกัน 2 list:
    - parents: เก็บไว้ใน DB คอลัมน์ parent_text -> ให้ LLM อ่านตอนตอบคำถาม
    - children: เอาไป embed เท่านั้น -> ใช้ค้นหา (vec_cosine_distance)
      แต่ละ child มี .parent_index ชี้กลับไปหา parent ของตัวเองเสมอ

    parent_max_chars ควรใหญ่พอสมควร (ค่าเริ่มต้น 1200) เพราะเป็นสิ่งที่ยัดใส่ prompt
    ให้ LLM local (llama3.2 ผ่าน Ollama) อ่าน ต้องเผื่อ context window ไม่ให้ยาวเกิน
    ไปคูณกับจำนวน k ที่ retrieve มาต่อครั้ง (k=3-5 chunks) แล้วบวก system prompt เอง
    """
    sections = _split_into_sections(paragraphs)

    # ---- สร้าง Parent chunks: cap ขนาดด้วย recursive_split ถ้า section ยาวเกิน ----
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
            sub_pieces = recursive_split(
                body, max_chars=budget, overlap_chars=parent_overlap_chars
            )
            for piece in sub_pieces:
                full_text = f"{prefix}\n{piece}" if prefix else piece
                parents.append(ParentChunk(full_text, parent_idx, path))
                parent_idx += 1

    # ---- สร้าง Child chunks: ตัด parent แต่ละก้อนซ้ำให้เล็กลงอีกชั้น ----
    children: list[ChildChunk] = []
    child_idx = 0

    for parent in parents:
        # parent ก้อนเล็กพอแล้ว (สั้นกว่า child_max_chars อยู่แล้ว)
        # -> ใช้ตัวเองเป็น child เลย ไม่ต้องเสียเวลาตัดซ้ำก้อนที่เล็กอยู่แล้ว
        if len(parent.text) <= child_max_chars:
            children.append(
                ChildChunk(parent.text, child_idx, parent.parent_index, parent.path)
            )
            child_idx += 1
            continue

        sub_pieces = recursive_split(
            parent.text, max_chars=child_max_chars, overlap_chars=child_overlap_chars
        )
        for piece in sub_pieces:
            children.append(
                ChildChunk(piece, child_idx, parent.parent_index, parent.path)
            )
            child_idx += 1

    return parents, children