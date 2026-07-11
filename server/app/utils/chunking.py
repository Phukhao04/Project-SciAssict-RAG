"""
Chunking utility สำหรับ RAG pipeline
- แบ่งเอกสารเป็นประโยค/ย่อหน้าก่อน (กันตัดกลางคำในภาษาไทย)
- รวมประโยคเข้าด้วยกันจนใกล้ max_chars ที่กำหนด
- มี overlap ระหว่าง chunk กันบริบทขาดตรงรอยต่อ
"""
import re
from dataclasses import dataclass


@dataclass
class Chunk:
    text: str
    chunk_index: int
    char_count: int


def split_into_sentences(text: str) -> list[str]:
    """
    แบ่งข้อความเป็นประโยค/ย่อหน้าย่อยๆ ก่อน โดยใช้ตัวแบ่งที่ชัดเจน:
    - ขึ้นบรรทัดใหม่ (\\n)
    - เว้นวรรค 2 ครั้งขึ้นไป (มักใช้แบ่งประโยคในเอกสารไทย)
    - เครื่องหมาย ฯ, . ตามด้วยเว้นวรรค (ระวัง . ในตัวย่อ/ตัวเลข)
    """
    # normalize whitespace ที่ซ้ำซ้อนก่อน แต่เก็บ \n ไว้แบ่งประโยค
    text = text.strip()
    # แบ่งตามบรรทัดใหม่หรือช่องว่างยาวๆ ก่อน
    rough_splits = re.split(r"\n+|\s{2,}", text)

    sentences: list[str] = []
    for part in rough_splits:
        part = part.strip()
        if not part:
            continue
        # แบ่งต่อด้วยเครื่องหมายจบประโยคภาษาไทย/สากล ถ้ามี
        sub = re.split(r"(?<=[.!?ฯ])\s+", part)
        sentences.extend(s.strip() for s in sub if s.strip())

    return sentences


def chunk_text(
    text: str,
    max_chars: int = 500,
    overlap_sentences: int = 1,
) -> list[Chunk]:
    """
    รวมประโยคเป็น chunk ขนาดไม่เกิน max_chars ตัวอักษร
    overlap_sentences = จำนวนประโยคท้ายของ chunk ก่อนหน้าที่จะเอามาขึ้นต้น chunk ถัดไป
    """
    sentences = split_into_sentences(text)
    if not sentences:
        return []

    chunks: list[Chunk] = []
    current: list[str] = []
    current_len = 0
    idx = 0

    for sentence in sentences:
        sentence_len = len(sentence)

        # ถ้าประโยคเดียวยาวเกิน max_chars ก็ปล่อยเป็น chunk เดี่ยวไปเลย
        if sentence_len > max_chars:
            if current:
                chunks.append(Chunk(" ".join(current), idx, current_len))
                idx += 1
                current, current_len = [], 0
            chunks.append(Chunk(sentence, idx, sentence_len))
            idx += 1
            continue

        # ถ้าใส่ประโยคนี้แล้วเกิน max_chars ให้ปิด chunk ปัจจุบันก่อน
        if current_len + sentence_len > max_chars and current:
            chunks.append(Chunk(" ".join(current), idx, current_len))
            idx += 1
            # เอา overlap ประโยคท้ายๆ มาขึ้นต้น chunk ใหม่
            current = current[-overlap_sentences:] if overlap_sentences > 0 else []
            current_len = sum(len(s) for s in current)

        current.append(sentence)
        current_len += sentence_len

    if current:
        chunks.append(Chunk(" ".join(current), idx, current_len))

    return chunks


if __name__ == "__main__":
    sample = """คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์ วิทยาเขตหาดใหญ่ จัดตั้งขึ้นในปี พ.ศ. 2510 ซึ่งเป็นปีเดียวกับการก่อตั้งมหาวิทยาลัยสงขลานครินทร์
คณะวิทยาศาสตร์ ประกอบด้วย 4 สาขา ได้แก่ วิทยาศาสตร์กายภาพ วิทยาศาสตร์ชีวภาพ วิทยาศาสตร์การคำนวณ และวิทยาศาสตร์สุขภาพและวิทยาศาสตร์ประยุกต์
จัดการเรียนการสอนออกเป็นหลักสูตรปริญญาตรี 13 หลักสูตร และระดับบัณฑิตศึกษา 28 หลักสูตร คือปริญญาโท 17 หลักสูตร (มีหลักสูตรนานาชาติ 5 หลักสูตร) และปริญญาเอก 11 หลักสูตร (มีหลักสูตรนานาชาติ 6 หลักสูตร)
วิสัยทัศน์ คือ คณะวิทยาศาสตร์เพื่อการพัฒนาที่ยั่งยืน
คณบดี คือ ศาสตราจารย์ ดร.อัญชนา ประเทพ"""

    result = chunk_text(sample, max_chars=150, overlap_sentences=1)
    for c in result:
        print(f"--- chunk {c.chunk_index} ({c.char_count} chars) ---")
        print(c.text)
        print()