"""
Ingestion pipeline: document text -> chunks -> embeddings -> TiDB

ใช้ SQLAlchemy Session (จาก server/app/db/session.py ที่มีอยู่แล้ว)
แทนการ hardcode mysql.connector.connect() ตรงๆ แบบโค้ดเดิม

Schema ตาม data dictionary จริง:
  document(document_id PK, document_name, document_type, category_id FK,
           user_id FK, upload_date, description)
  document_chunk(chunk_id PK, document_id FK -> document, chunk_text,
                 embedding_vector VECTOR(1024), created_at)

หมายเหตุ: embedding_vector ปรับเป็น VECTOR(1024) ให้ตรงกับ bge-m3
(ตามที่ตกลงแก้ data dictionary แล้ว ไม่ใช่ 384 ตามฉบับเดิม)
"""
import json
from sqlalchemy import text
from sqlalchemy.orm import Session

from .chunking import chunk_text
from .embedding import embed_batch


def ingest_document(
    db: Session,
    full_text: str,
    document_name: str,
    document_type: str,
    category_id: int,
    user_id: int,
    description: str | None = None,
    max_chars: int = 500,
    overlap_sentences: int = 1,
) -> dict:
    """
    รับเอกสารเต็ม -> insert record ใน document -> chunk -> embed ->
    insert เข้า document_chunk ทั้งหมด (ผูกกับ document_id ที่เพิ่ง insert)

    return dict {"document_id": ..., "chunks_inserted": ...}
    """
    # 1) insert เข้า document ก่อน เพื่อได้ document_id มาใช้เป็น FK
    insert_doc_sql = text(
        """
        INSERT INTO document (document_name, document_type, category_id, user_id, upload_date, description)
        VALUES (:document_name, :document_type, :category_id, :user_id, NOW(), :description)
        """
    )
    result = db.execute(
        insert_doc_sql,
        {
            "document_name": document_name,
            "document_type": document_type,
            "category_id": category_id,
            "user_id": user_id,
            "description": description,
        },
    )
    document_id = result.lastrowid

    # 2) chunk เนื้อหา
    chunks = chunk_text(full_text, max_chars=max_chars, overlap_sentences=overlap_sentences)
    if not chunks:
        db.commit()
        return {"document_id": document_id, "chunks_inserted": 0}

    # 3) embed ทีเดียวเป็น batch เร็วกว่า loop ทีละ chunk
    texts = [c.text for c in chunks]
    embeddings = embed_batch(texts)

    # 4) insert เข้า document_chunk แบบ parameterized query (กัน SQL injection)
    insert_chunk_sql = text(
        """
        INSERT INTO document_chunk (document_id, chunk_text, embedding_vector, created_at)
        VALUES (:document_id, :chunk_text, :embedding_vector, NOW())
        """
    )

    for chunk, embedding in zip(chunks, embeddings):
        db.execute(
            insert_chunk_sql,
            {
                "document_id": document_id,
                "chunk_text": chunk.text,
                "embedding_vector": json.dumps(embedding),
            },
        )

    db.commit()
    return {"document_id": document_id, "chunks_inserted": len(chunks)}


# ตัวอย่างการเรียกใช้จริงใน FastAPI endpoint (ไม่ต้อง run ตรงนี้ แค่โชว์ pattern)
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.utils.ingestion import ingest_document

router = APIRouter()

@router.post("/documents/ingest")
def ingest(
    text: str,
    document_name: str,
    document_type: str,
    category_id: int,
    user_id: int,
    db: Session = Depends(get_db),
):
    result = ingest_document(db, text, document_name, document_type, category_id, user_id)
    return result
"""