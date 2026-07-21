"""
Ingestion pipeline

หน้าที่
1. บันทึกข้อมูลเอกสาร
2. แบ่งเอกสารเป็น Chunk
3. สร้าง Embedding ของแต่ละ Chunk
4. บันทึก Chunk และ Vector ลงฐานข้อมูล
"""

import json
import re

from sqlalchemy import text
from sqlalchemy.orm import Session

from .hierarchical_chunking import hierarchical_chunk
from .embedding import get_embedder


def clean_text(text: str) -> str:
    """
    ทำความสะอาดข้อความก่อนสร้าง Embedding
    """

    text = text.replace("\u00A0", " ")
    text = text.replace("\t", " ")

    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ ]{2,}", " ", text)

    return text.strip()


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

    # -----------------------------
    # 1) Insert Document
    # -----------------------------

    insert_doc_sql = text(
        """
        INSERT INTO document
        (
            document_name,
            document_type,
            category_id,
            user_id,
            upload_date,
            description
        )
        VALUES
        (
            :document_name,
            :document_type,
            :category_id,
            :user_id,
            NOW(),
            :description
        )
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

    db.commit()

    # -----------------------------
    # 2) Chunk
    # -----------------------------

    chunks = hierarchical_chunk(
        full_text,
        level_patterns=level_patterns or [],
        max_chars=max_chars,
        overlap_chars=overlap_chars,
        header_prefix=document_name,
    )

    if not chunks:
        return {
            "document_id": document_id,
            "chunks_inserted": 0,
        }

    # -----------------------------
    # 3) Prepare Text
    # -----------------------------

    texts = []

    for chunk in chunks:

        text_for_embedding = clean_text(
            f"""
เอกสาร : {document_name}

เนื้อหา :

{chunk.text}
"""
        )

        texts.append(text_for_embedding)

    # -----------------------------
    # 4) Embedding (Batch)
    # -----------------------------

    embedder = get_embedder()

    embeddings = embedder.encode(
        texts,
        normalize_embeddings=True,
        batch_size=32,
        show_progress_bar=False,
    ).tolist()

    # -----------------------------
    # 5) Insert Chunks
    # -----------------------------

    insert_chunk_sql = text(
        """
        INSERT INTO document_chunk
        (
            document_id,
            chunk_text,
            embedding_vector,
            created_at
        )
        VALUES
        (
            :document_id,
            :chunk_text,
            :embedding_vector,
            NOW()
        )
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

    return {
        "document_id": document_id,
        "chunks_inserted": len(chunks),
    }