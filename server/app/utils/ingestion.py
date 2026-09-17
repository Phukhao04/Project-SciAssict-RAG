import json
import re

from sqlalchemy import text
from sqlalchemy.orm import Session

from .embedding import get_embedder


def clean_text(raw: str) -> str:
    """ทำความสะอาดข้อความก่อนสร้าง Embedding"""
    raw = raw.replace("\u00a0", " ")
    raw = raw.replace("\t", " ")
    raw = re.sub(r"\n{3,}", "\n\n", raw)
    raw = re.sub(r"[ ]{2,}", " ", raw)
    return raw.strip()


def _insert_document_row(
    db: Session,
    document_name: str,
    document_type: str,
    category_id: int,
    user_id: int,
    description: str | None,
) -> int:
    """Insert แถวใน `document` แล้วคืน document_id ที่ได้
    เรียกจาก manual_ingest.py -> confirm_manual_ingest()"""
    insert_doc_sql = text("""
        INSERT INTO document
        (document_name, document_type, category_id, user_id, upload_date, description)
        VALUES
        (:document_name, :document_type, :category_id, :user_id, NOW(), :description)
        """)

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
    db.commit()
    return document_id


def _embed_and_insert_chunks(db: Session, document_id: int, chunks: list[dict]) -> int:
    """Embed แล้ว insert chunk ทั้งหมดลง document_chunk คืนจำนวน chunk
    ที่ insert สำเร็จ - เรียกจาก manual_ingest.py -> confirm_manual_ingest()"""
    if not chunks:
        return 0

    texts = [clean_text(c["parent_text"]) for c in chunks]

    embedder = get_embedder()
    embeddings = embedder.encode(
        texts,
        normalize_embeddings=True,
        batch_size=32,
        show_progress_bar=False,
    ).tolist()

    insert_chunk_sql = text("""
        INSERT INTO document_chunk
        (document_id, chunk_text, parent_text, embedding_vector, created_at)
        VALUES
        (:document_id, :chunk_text, :parent_text, :embedding_vector, NOW())
        """)

    for chunk, embedding in zip(chunks, embeddings):
        db.execute(
            insert_chunk_sql,
            {
                "document_id": document_id,
                "chunk_text": chunk["chunk_text"],
                "parent_text": chunk["parent_text"],
                "embedding_vector": json.dumps(embedding),
            },
        )

    db.commit()
    return len(chunks)