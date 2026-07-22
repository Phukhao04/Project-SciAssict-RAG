"""
Hierarchical + Recursive Chunking
==================================
แนวคิด: เอกสารราชการ/หลักสูตรมักมีโครงสร้างเป็นลำดับชั้น (hierarchy) ชัดเจน
เช่น "ปีที่ 1 > ภาคการศึกษาที่ 1 > รายวิชา" หรือ "ประกาศ > คุณสมบัติ > เอกสารที่ใช้"

ขั้นที่ 1 (Hierarchical): แบ่งตามหัวข้อจริงในเอกสารก่อน ใช้ regex pattern
          ของแต่ละ "ชั้น" (level) เป็นตัวกำหนดขอบเขต ไม่ตัดข้ามหัวข้อ

ขั้นที่ 2 (Recursive): ถ้า section ไหนยังยาวเกิน max_chars (เช่น คำอธิบาย
          รายวิชายาวมาก) ค่อยตัดซ้ำด้วยขนาดคงที่ + overlap เป็นตัวสำรอง
          ทำแบบ "recursive" คือลองแบ่งหน่วยใหญ่ก่อน (ย่อหน้า) แล้วค่อยลง
          หน่วยเล็กลง (ประโยค) ถ้ายังยาวไปอีก
"""
import re
from dataclasses import dataclass, field


@dataclass
class Chunk:
    text: str
    chunk_index: int
    path: tuple  # เก็บ "เส้นทางหัวข้อ" เช่น ("ปีที่ 1", "ภาคการศึกษาที่ 1")


# ---------- ขั้นที่ 2: Recursive splitter (ตัวสำรองเมื่อ section ยาวเกิน) ----------

def _split_sentences(text: str) -> list[str]:
    """แบ่งข้อความเป็นประโยคย่อย (หน่วยเล็กสุดที่ยอมตัด ไม่ตัดกลางประโยค)"""
    text = text.strip()
    rough = re.split(r"\n+|\s{2,}", text)
    sentences = []
    for part in rough:
        part = part.strip()
        if not part:
            continue
        sentences.extend(s.strip() for s in re.split(r"(?<=[.!?ฯ])\s+", part) if s.strip())
    return sentences


def _pack_units(units: list[str], max_chars: int, overlap_chars: int, joiner: str = " ") -> list[str]:
    """
    ฟังก์ชันกลาง: รวม 'หน่วยข้อความ' (จะเป็นประโยคหรือคำก็ได้) เข้าด้วยกัน
    จนใกล้ max_chars แล้วเว้น overlap_chars ให้ก้อนถัดไป
    ใช้ร่วมกันทั้งระดับ "ประโยค" และระดับ "คำ" เพื่อไม่ต้องเขียนโค้ดซ้ำ
    """
    pieces: list[str] = []
    current: list[str] = []
    current_len = 0

    for unit in units:
        u_len = len(unit)

        if current_len + u_len > max_chars and current:
            pieces.append(joiner.join(current))
            overlap_units, acc = [], 0
            for u in reversed(current):
                if acc >= overlap_chars:
                    break
                overlap_units.insert(0, u)
                acc += len(u)
            current = overlap_units
            current_len = sum(len(u) for u in current)

        current.append(unit)
        current_len += u_len

    if current:
        pieces.append(joiner.join(current))

    return pieces


def _hard_split(text: str, max_chars: int, overlap_chars: int) -> list[str]:
    """
    ตัวสำรองสุดท้าย: ตัดตรงตามจำนวนตัวอักษรเป๊ะๆ (ไม่สนใจคำ/ประโยค)
    ใช้เฉพาะกรณีไม่มีจุดแบ่งธรรมชาติเหลือแล้วจริงๆ (เช่น URL ยาวๆ หรือคำยาวผิดปกติ)
    """
    step = max(max_chars - overlap_chars, 1)
    return [text[i : i + max_chars] for i in range(0, len(text), step)]


def recursive_split(text: str, max_chars: int = 500, overlap_chars: int = 75) -> list[str]:
    """
    ตัดข้อความยาวเป็นชิ้นขนาด ~max_chars ตัวอักษร ไล่ระดับความละเอียดจากหยาบไปละเอียด:
    1) ลองแบ่งเป็น "ประโยค" ก่อน (ธรรมชาติสุด อ่านแล้วยังได้ใจความ)
    2) ถ้าประโยคไหนยังยาวเกิน max_chars เอง (ภาษาไทยเขียนยาวไม่มีจุดคั่นบ่อยมาก)
       ค่อยลงไปแบ่งระดับ "คำ" (เว้นวรรค) แทน
    3) ถ้าคำเดียวก็ยังยาวเกิน (กรณีหายาก เช่น URL) ค่อยตัดตรงตามตัวอักษรเป๊ะๆ เป็นทางสุดท้าย
    """
    sentences = _split_sentences(text)
    if not sentences:
        return []

    # ระดับ 1: ลองรวมประโยคแบบปกติก่อน
    packed = _pack_units(sentences, max_chars, overlap_chars, joiner=" ")

    # เช็คทุกชิ้นที่ได้ ถ้าชิ้นไหนยังยาวเกิน (เพราะมาจากประโยคเดี่ยวที่ยาวเกิน max_chars)
    # ให้ recurse ลงไปแบ่งละเอียดขึ้นเฉพาะชิ้นนั้น
    final_pieces: list[str] = []
    for piece in packed:
        if len(piece) <= max_chars:
            final_pieces.append(piece)
            continue

        # ระดับ 2: แบ่งเป็นคำ
        words = piece.split(" ")
        word_packed = _pack_units(words, max_chars, overlap_chars, joiner=" ")

        for wp in word_packed:
            if len(wp) <= max_chars:
                final_pieces.append(wp)
            else:
                # ระดับ 3: ตัดตรงตามตัวอักษร (ทางสุดท้ายจริงๆ)
                final_pieces.extend(_hard_split(wp, max_chars, overlap_chars))

    return final_pieces


# ---------- ขั้นที่ 1: Hierarchical splitter (แบ่งตามโครงสร้างหัวข้อ) ----------

def hierarchical_chunk(
    text: str,
    level_patterns: list[re.Pattern],
    max_chars: int = 550,
    overlap_chars: int = 75,
    header_prefix: str = "",
) -> list[Chunk]:
    """
    level_patterns: list ของ regex เรียงจากหัวข้อใหญ่สุด -> เล็กสุด
                    แต่ละ pattern ต้อง match ที่ "จุดเริ่มบรรทัด" เท่านั้น (ใช้ .match())
                    ตัวอย่าง: [re.compile(r"ปีที่\\s*(\\d+)"), re.compile(r"ภาคการศึกษาที่\\s*(\\d+)")]

    วิธีทำงาน:
    1. ไล่ทีละบรรทัด เจอ header ระดับไหน ก็ปิด section เดิม เริ่ม section ใหม่
       และ "รีเซ็ต" หัวข้อของทุกระดับที่ลึกกว่า (เช่นเจอปีใหม่ ต้องรีเซ็ตเทอมเก่าทิ้ง)
    2. ได้ section ทั้งหมดพร้อม "เส้นทางหัวข้อ" (path) กำกับ
    3. section ไหนยาวเกิน max_chars -> ส่งต่อให้ recursive_split ตัดซ้ำ
       แล้วแปะ path เดิมกำกับไว้ทุกชิ้นย่อย (ให้ค้นหาแล้วยังรู้บริบทเดิม)
    """
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]

    sections: list[tuple[tuple, str]] = []
    current_path: list[str | None] = [None] * len(level_patterns)
    current_body: list[str] = []

    def flush():
        if current_body:
            sections.append((tuple(current_path), "\n".join(current_body)))
        current_body.clear()

    for line in lines:
        matched_level = None
        for level_idx, pattern in enumerate(level_patterns):
            if pattern.match(line):
                matched_level = level_idx
                break

        if matched_level is not None:
            flush()
            current_path[matched_level] = line
            # รีเซ็ตหัวข้อของทุกระดับที่ "ลึกกว่า" ระดับที่เพิ่งเจอ
            for deeper in range(matched_level + 1, len(current_path)):
                current_path[deeper] = None
            continue

        current_body.append(line)

    flush()

    # แปลง sections เป็น Chunk จริง พร้อม apply recursive split ถ้ายาวเกิน
    result: list[Chunk] = []
    idx = 0
    for path, body in sections:
        path_str = " > ".join(p for p in path if p)
        prefix_parts = [p for p in [header_prefix, path_str] if p]
        prefix = " | ".join(prefix_parts)

        candidate = f"{prefix}\n{body}" if prefix else body

        if len(candidate) <= max_chars:
            result.append(Chunk(candidate, idx, path))
            idx += 1
        else:
            # เหลือพื้นที่ให้เนื้อหาจริงเท่ากับ max_chars ลบความยาว prefix
            budget = max(max_chars - len(prefix) - 1, 100)  # กันเหลือน้อยเกินไป
            sub_pieces = recursive_split(body, max_chars=budget, overlap_chars=overlap_chars)
            for piece in sub_pieces:
                full_text = f"{prefix}\n{piece}" if prefix else piece
                result.append(Chunk(full_text, idx, path))
                idx += 1

    return result