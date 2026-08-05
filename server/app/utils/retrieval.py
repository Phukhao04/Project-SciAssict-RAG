"""
Retrieval Service

หน้าที่
1. ถ้าคำถามระบุ "ปี X" / "เทอม Y" ชัดเจน -> ดึง chunk จาก heading ที่ตรง
   ตัวเป๊ะโดยตรง (LIKE บน parent_text) ข้าม vector search ไปเลย
2. ถ้าไม่เข้าเงื่อนไขข้อ 1 (คำถามทั่วไป ไม่ระบุปี/เทอม) -> fallback ไปใช้
   vector search แบบเดิม (child chunk embedding ใกล้สุด)

v2: เพิ่ม heading-match เพราะเจอจริงจากการทดสอบว่า dense embedding
(bge-m3) แยกไม่แม่นเวลาคำถามมีคำว่า "ICT" ปนอยู่ - เนื้อหาวิชาปีที่ 4
(เทคโนโลยีสารสนเทศเฉพาะทางล้วนๆ) มีคำว่า "เทคโนโลยีสารสนเทศ" ซ้ำเยอะ
กว่าปีที่ 1 (วิชาพื้นฐานทั่วไป) มาก ทำให้ embedding เอนเอียงไปทางปีที่ 4
ทั้งที่คำถามถามหาปีที่ 1 ชัดเจน - ปัญหานี้เป็นที่รู้จักกันดีว่า dense
retrieval แม่นน้อยกว่ากับ query ที่มี exact identifier (เลขปี/เทอม)
ชัดเจนอยู่แล้ว ทางแก้ตรงจุดคือ bypass vector search ไปเลยกรณีนี้
"""

import json
import logging
import re
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.orm import Session

from .embedding import embed_query

logger = logging.getLogger(__name__)


@dataclass
class RetrievedChunk:
    chunk_text: str  # child text ที่แมตช์จริง (เก็บไว้เผื่อ debug/citation)
    parent_text: str  # parent text (ส่งให้ LLM อ่านจริง)
    document_id: int
    document_name: str
    distance: float
    match_type: str = "vector"  # "heading" (แมตช์ตรงจาก heading) หรือ "vector"
    # (จาก cosine similarity) - llm.py ใช้ field นี้ตัดสินใจว่าจะ format
    # คำตอบตรงๆ (heading) หรือให้ LLM เรียบเรียง (vector)


# จับเลขปี/เทอมจากคำถาม รองรับทั้ง "ปี 1" และ "ปีที่ 1" / "เทอม 1" และ
# "ภาคการศึกษาที่ 1" (คนละคำพูดแต่ความหมายเดียวกัน คนถามมักพิมพ์แบบย่อ)
YEAR_PATTERN = re.compile(r"ปี(?:ที่)?\s*(\d+)")
SEMESTER_PATTERN = re.compile(r"(?:เทอม|ภาคการศึกษา(?:ที่)?)\s*(\d+)")

# ปีที่ 4 แยกเป็น "แบบที่ 1 ไม่ใช่สหกิจศึกษา" กับ "แบบที่ 2 สหกิจศึกษา"
# ต้องระวัง "สหกิจศึกษา" เป็น substring ของ "ไม่ใช่สหกิจศึกษา" ด้วย
# (?<!ไม่ใช่) กันไม่ให้ COOP_PATTERN ไป match คำถามที่จริงๆ พูดถึง
# "ไม่ใช่สหกิจ" อยู่แล้ว
NOT_COOP_PATTERN = re.compile(r"ไม่ใช่สหกิจ")
COOP_PATTERN = re.compile(r"(?<!ไม่ใช่)สหกิจศึกษา")


def _try_heading_match(db: Session, question: str) -> list[RetrievedChunk]:
    """
    ถ้าคำถามระบุปีชัดเจน (มีคำว่า "ปี"/"ปีที่" ตามด้วยตัวเลข) ลองดึง chunk
    ที่ parent_text มี heading ตรงเงื่อนไขทั้งหมดที่คำถามระบุ (ปี, เทอมถ้ามี,
    แบบสหกิจ/ไม่สหกิจถ้ามี) คืน list ว่างถ้าไม่มีเลขปีในคำถามเลย (ให้
    retrieve() ไป fallback ใช้ vector search ตามปกติ)
    """
    year_match = YEAR_PATTERN.search(question)
    if not year_match:
        return []

    year_num = year_match.group(1)
    conditions = ["dc.parent_text LIKE :year_pattern"]
    params: dict = {"year_pattern": f"%ปีที่ {year_num}%"}

    semester_match = SEMESTER_PATTERN.search(question)
    if semester_match:
        semester_num = semester_match.group(1)
        conditions.append("dc.parent_text LIKE :semester_pattern")
        params["semester_pattern"] = f"%ภาคการศึกษาที่ {semester_num}%"

    if NOT_COOP_PATTERN.search(question):
        conditions.append("dc.parent_text LIKE :coop_pattern")
        params["coop_pattern"] = "%ไม่ใช่สหกิจ%"
    elif COOP_PATTERN.search(question):
        conditions.append("dc.parent_text LIKE :coop_pattern")
        conditions.append("dc.parent_text NOT LIKE :not_coop_pattern")
        params["coop_pattern"] = "%สหกิจศึกษา%"
        params["not_coop_pattern"] = "%ไม่ใช่สหกิจศึกษา%"

    where_clause = " AND ".join(conditions)
    sql = text(f"""
        SELECT
            dc.chunk_text,
            dc.parent_text,
            dc.document_id,
            d.document_name
        FROM document_chunk dc
        JOIN document d
            ON dc.document_id = d.document_id
        WHERE {where_clause}
    """)

    rows = db.execute(sql, params).fetchall()

    return [
        RetrievedChunk(
            chunk_text=row.chunk_text,
            parent_text=row.parent_text,
            document_id=row.document_id,
            document_name=row.document_name,
            distance=0.0,  # ไม่ใช่ vector search เลยไม่มี distance จริง
            match_type="heading",
        )
        for row in rows
    ]


def _retrieve_by_vector(db: Session, query_text_str: str, k: int) -> list[RetrievedChunk]:
    """vector search แบบเดิม (ไม่เปลี่ยนอะไรจากของเดิม)"""
    query_embedding = embed_query(query_text_str)

    sql = text("""
        SELECT
            dc.chunk_text,
            dc.parent_text,
            dc.document_id,
            d.document_name,
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

    return [
        RetrievedChunk(
            chunk_text=row.chunk_text,
            parent_text=row.parent_text,
            document_id=row.document_id,
            document_name=row.document_name,
            distance=row.distance,
            match_type="vector",
        )
        for row in rows
    ]


def retrieve(db: Session, query_text_str: str, k: int = 5) -> list[RetrievedChunk]:
    """
    คืนค่า chunk ที่เกี่ยวข้องกับคำถาม

    ลอง heading-match ก่อนเสมอ (ถ้าคำถามระบุปีชัดเจน) เพราะแม่นกว่า
    vector search มากสำหรับคำถามแบบนี้ - ถ้าไม่ match อะไรเลย (คำถามไม่มี
    เลขปี หรือ heading match แล้วไม่เจอแถวไหนตรงเงื่อนไขจริงๆ) ค่อย
    fallback ไป vector search ตามปกติ
    """
    heading_matches = _try_heading_match(db, query_text_str)
    if heading_matches:
        logger.info(
            f"[retrieve] ใช้ heading-match ({len(heading_matches)} chunks) "
            f"แทน vector search สำหรับคำถาม: {query_text_str!r}"
        )
        return heading_matches

    return _retrieve_by_vector(db, query_text_str, k)