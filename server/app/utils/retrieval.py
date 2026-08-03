"""
Retrieval Service

หน้าที่
1. สร้าง Query Embedding
2. ค้นหา "child" chunk ที่ใกล้ที่สุดจาก TiDB (embedding มาจาก child เท่านั้น)
3. ส่ง "parent" text (บริบทเต็ม section) กลับให้ LLM แทนที่จะส่ง child text ตรงๆ
   (แม่นตอนค้นเพราะ child เล็กโฟกัส, ครบตอนตอบเพราะ parent มีบริบทกว่า)
"""

import json
import logging
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


def retrieve(db: Session, query_text_str: str, k: int = 5) -> list[RetrievedChunk]:
    """คืนค่า k child chunk ที่ใกล้เคียงกับคำถามมากที่สุด พร้อม parent text คู่กัน"""

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
        )
        for row in rows
    ]