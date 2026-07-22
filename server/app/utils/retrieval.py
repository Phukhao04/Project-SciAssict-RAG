"""
Retrieval Service

หน้าที่
1. สร้าง Query Embedding
2. ค้นหา Vector ที่ใกล้ที่สุดจาก TiDB
3. กรองผลลัพธ์ที่ไม่เกี่ยวข้อง
4. ส่ง Context กลับให้ LLM
"""

import json
import logging
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.orm import Session

from .embedding import embed_query

logger = logging.getLogger(__name__)

# ระยะห่างสูงสุดที่ยอมรับ
# ยิ่งน้อยยิ่งเกี่ยวข้อง
MAX_DISTANCE = 0.55


@dataclass
class RetrievedChunk:
    chunk_text: str
    document_id: int
    document_name: str
    distance: float


def retrieve(
    db: Session,
    query_text_str: str,
    k: int = 5,
) -> list[RetrievedChunk]:

    # -------------------------
    # Query Embedding
    # -------------------------
    query_embedding = embed_query(query_text_str.strip())

    # -------------------------
    # Vector Search
    # -------------------------
    sql = text("""
        SELECT
            dc.chunk_text,
            dc.document_id,
            d.document_name,
            vec_cosine_distance(
                dc.embedding_vector,
                :query_embedding
            ) AS distance
        FROM document_chunk dc
        JOIN document d
            ON dc.document_id = d.document_id
        ORDER BY distance ASC
        LIMIT :k
        """)

    rows = db.execute(
        sql,
        {
            "query_embedding": json.dumps(query_embedding),
            "k": k,
        },
    ).fetchall()

    # -------------------------
    # Filter
    # -------------------------
    results: list[RetrievedChunk] = []

    logger.debug("Question: %s", query_text_str)

    for row in rows:
        distance = float(row[3])

        logger.debug("%s | distance=%.4f", row[2], distance)

        if distance <= MAX_DISTANCE:
            results.append(
                RetrievedChunk(
                    chunk_text=row[0],
                    document_id=row[1],
                    document_name=row[2],
                    distance=distance,
                )
            )

    logger.debug("Retrieved %d chunks", len(results))

    return results
