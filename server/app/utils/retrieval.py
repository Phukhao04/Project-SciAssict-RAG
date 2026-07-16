"""
Retrieval: คำถาม -> embed -> vector search ใน TiDB
ทำไมต้องแปลงคำถามเป็น vector ก่อนค้นหา: เพราะเราเก็บ chunk เป็น vector ไว้แล้ว
การเทียบว่า "คำถามนี้ใกล้เคียงกับ chunk ไหนที่สุด" ต้องเทียบในรูปแบบเดียวกัน (vector กับ vector)
"""
import json
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.orm import Session

from .embedding import embed_text


@dataclass
class RetrievedChunk:
    chunk_text: str
    document_id: int
    document_name: str
    distance: float  # ยิ่งใกล้ 0 ยิ่งเกี่ยวข้องกับคำถามมาก


def retrieve(db: Session, query_text_str: str, k: int = 5) -> list[RetrievedChunk]:
    """คืน k chunk ที่ใกล้เคียงกับคำถามที่สุด (เรียงจากใกล้ไปไกล)"""
    query_embedding = embed_text(query_text_str)

    # vec_cosine_distance คือฟังก์ชันของ TiDB ที่คำนวณ "ระยะห่างเชิงมุม" ระหว่าง 2 vector
    # ยิ่งค่าน้อย ยิ่งความหมายใกล้เคียงกัน
    sql = text(
        """
        SELECT dc.chunk_text, dc.document_id, d.document_name,
               vec_cosine_distance(dc.embedding_vector, :query_embedding) AS distance
        FROM document_chunk dc
        JOIN document d ON dc.document_id = d.document_id
        ORDER BY distance
        LIMIT :k
        """
    )

    rows = db.execute(
        sql,
        {"query_embedding": json.dumps(query_embedding), "k": k},
    ).fetchall()

    return [
        RetrievedChunk(chunk_text=r[0], document_id=r[1], document_name=r[2], distance=r[3])
        for r in rows
    ]