"""
Retrieval: query text -> embed -> vector search ใน TiDB

จุดที่แก้จากโค้ดเดิม:
- เดิมใช้ f-string ใส่ embedding ตรงลง SQL string -> เสี่ยง SQL injection
- ตอนนี้ใช้ parameterized query (:query_embedding) แทน
- join กับ document เพื่อได้ document_name/document_id ติดมาด้วย (เดิมมีแค่ text เปล่าๆ)
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
    distance: float


def retrieve(db: Session, query_text_str: str, k: int = 5) -> list[RetrievedChunk]:
    """คืน k chunk ที่ใกล้เคียงกับคำถามที่สุด (เรียงจากใกล้ไปไกล)"""
    query_embedding = embed_text(query_text_str)

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


# ตัวอย่างการเรียกใช้จริงใน FastAPI endpoint
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.utils.retrieval import retrieve

router = APIRouter()

@router.get("/search")
def search(q: str, k: int = 5, db: Session = Depends(get_db)):
    results = retrieve(db, q, k)
    return [{"content": r.content, "source": r.source, "distance": r.distance} for r in results]
"""