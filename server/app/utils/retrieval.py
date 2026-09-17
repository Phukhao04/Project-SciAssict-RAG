import json
import logging
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.orm import Session

from .embedding import embed_query

logger = logging.getLogger(__name__)


@dataclass
class RetrievedChunk:
    chunk_text: str
    parent_text: str
    document_id: int
    document_name: str
    distance: float
    match_type: str = "vector"


def retrieve(db: Session, query_text_str: str, k: int = 5) -> list[RetrievedChunk]:
    """
    คืนค่า chunk ที่เกี่ยวข้องกับคำถาม ด้วย vector search (cosine distance) ล้วนๆ
    """
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