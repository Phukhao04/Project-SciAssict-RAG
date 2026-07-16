"""
Ingestion pipeline: เอกสารเต็ม -> chunk (hierarchical) -> embed -> insert เข้า DB
ทำไม insert เข้า document ก่อน document_chunk:
เพราะ document_chunk มี FK ผูกกับ document_id ต้องมี document อยู่ก่อนถึงจะ insert chunk ได้

ทำไมใช้ hierarchical_chunk แม้กับ text ธรรมดา (ไม่มีโครงสร้างหัวข้อ):
ส่ง level_patterns=[] (ว่างเปล่า) เข้าไป -> ไม่มี pattern ไหน match เลย
-> ทั้งข้อความกลายเป็น "1 section" เดียว -> ถ้ายาวเกิน max_chars
จะถูกส่งต่อให้ recursive_split ตัดต่ออัตโนมัติ (พฤติกรรมเหมือน chunk_text เดิมทุกประการ)
ทำให้ใช้ engine เดียวได้ทั้งกรณี "มีโครงสร้าง" และ "ไม่มีโครงสร้าง"
"""
import json
from sqlalchemy import text
from sqlalchemy.orm import Session

from .hierarchical_chunking import hierarchical_chunk
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
    overlap_chars: int = 75,
    level_patterns: list | None = None,
) -> dict:
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
    db.commit()  # commit ทันที กัน transaction ค้างนาน (เจอปัญหา connection หลุดมาก่อน)

    # 2) chunk เนื้อหาด้วย hierarchical_chunk (level_patterns=[] = ไม่มีโครงสร้าง ตัดตามขนาดอย่างเดียว)
    chunks = hierarchical_chunk(
        full_text,
        level_patterns=level_patterns or [],
        max_chars=max_chars,
        overlap_chars=overlap_chars,
        header_prefix=document_name,
    )
    if not chunks:
        return {"document_id": document_id, "chunks_inserted": 0}

    # 3) embed ทีเดียวเป็น batch (เร็วกว่า loop ทีละ chunk)
    texts = [c.text for c in chunks]
    embeddings = embed_batch(texts)

    # 4) insert เข้า document_chunk แบบ parameterized query
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