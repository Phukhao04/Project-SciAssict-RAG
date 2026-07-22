"""
Retrieval Service

หน้าที่
1. ปรับข้อความคำถาม (Query Normalization)
2. สร้าง Query Embedding
3. ค้นหา Vector ที่ใกล้ที่สุดจาก TiDB
4. กรองผลลัพธ์ที่ไม่เกี่ยวข้อง
5. ส่ง Context กลับให้ LLM
"""

import json
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.orm import Session

from .embedding import embed_query

# ระยะห่างสูงสุดที่ยอมรับ
# ยิ่งน้อยยิ่งเกี่ยวข้อง
MAX_DISTANCE = 0.45


NORMALIZE = {
    "คระ": "คณะ",
    "วิทย์": "วิทยาศาสตร์",
    "มอ": "มหาวิทยาลัยสงขลานครินทร์",
    "psu": "มหาวิทยาลัยสงขลานครินทร์",
}


@dataclass
class RetrievedChunk:
    chunk_text: str
    document_id: int
    document_name: str
    distance: float


def normalize_query(query: str) -> str:
    """
    แก้คำย่อและคำพิมพ์ผิดที่พบบ่อย
    """

    q = query.lower().strip()

    for old, new in NORMALIZE.items():
        q = q.replace(old, new)

    return q


def retrieve(
    db: Session,
    query_text_str: str,
    k: int = 5,
) -> list[RetrievedChunk]:

    # -------------------------
    # Normalize Query
    # -------------------------

    query_text_str = normalize_query(query_text_str)

    # -------------------------
    # Query Embedding
    # -------------------------

    query_embedding = embed_query(query_text_str)

    # -------------------------
    # Vector Search
    # -------------------------

    sql = text(
        """
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
        """
    )

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

    results = []

    print("\n==============================")
    print("Question :", query_text_str)
    print("==============================")

    for row in rows:

        distance = float(row[3])

        print(
            f"{row[2]} | distance={distance:.4f}"
        )

        if distance <= MAX_DISTANCE:

            results.append(
                RetrievedChunk(
                    chunk_text=row[0],
                    document_id=row[1],
                    document_name=row[2],
                    distance=distance,
                )
            )

    print(f"Retrieved : {len(results)} chunks\n")

    return results