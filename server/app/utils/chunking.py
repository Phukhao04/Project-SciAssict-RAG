"""
Chunking utility สำหรับ RAG pipeline
ทำไมต้องมีไฟล์นี้: embedding model แปลงข้อความยาวๆ เป็น vector ได้ไม่แม่น
ยิ่งข้อความยาว ยิ่งเสีย "รายละเอียด" ไป ต้องตัดเป็นชิ้นเล็กๆ (chunk) ก่อน
"""
import re
from dataclasses import dataclass


@dataclass
class Chunk:
    text: str
    chunk_index: int
    char_count: int


def split_into_sentences(text: str) -> list[str]:
    """แบ่งข้อความเป็นประโยคย่อยๆ ก่อน (กันตัดกลางคำในภาษาไทย)"""
    text = text.strip()
    rough_splits = re.split(r"\n+|\s{2,}", text)

    sentences: list[str] = []
    for part in rough_splits:
        part = part.strip()
        if not part:
            continue
        sub = re.split(r"(?<=[.!?ฯ])\s+", part)
        sentences.extend(s.strip() for s in sub if s.strip())

    return sentences


def chunk_text(text: str, max_chars: int = 500, overlap_sentences: int = 1) -> list[Chunk]:
    """
    รวมประโยคเป็น chunk ขนาดไม่เกิน max_chars
    overlap_sentences = เอาประโยคท้ายของ chunk ก่อนหน้า มาขึ้นต้น chunk ถัดไป
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

        if sentence_len > max_chars:
            if current:
                chunks.append(Chunk(" ".join(current), idx, current_len))
                idx += 1
                current, current_len = [], 0
            chunks.append(Chunk(sentence, idx, sentence_len))
            idx += 1
            continue

        if current_len + sentence_len > max_chars and current:
            chunks.append(Chunk(" ".join(current), idx, current_len))
            idx += 1
            current = current[-overlap_sentences:] if overlap_sentences > 0 else []
            current_len = sum(len(s) for s in current)

        current.append(sentence)
        current_len += sentence_len

    if current:
        chunks.append(Chunk(" ".join(current), idx, current_len))

    return chunks