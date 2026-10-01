import json
import re

from sqlalchemy import text
from sqlalchemy.orm import Session
from .embedding import get_embedder, build_embedding_text


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
    program_id: int | None = None,
    file_name: str | None = None,
    file_path: str | None = None,
    source_url: str | None = None,
) -> int:
    insert_doc_sql = text("""
        INSERT INTO document
        (document_name, document_type, category_id, user_id, upload_date,
         description, program_id, file_name, file_path, source_url)
        VALUES
        (:document_name, :document_type, :category_id, :user_id, NOW(),
         :description, :program_id, :file_name, :file_path, :source_url)
        """)

    result = db.execute(
        insert_doc_sql,
        {
            "document_name": document_name,
            "document_type": document_type,
            "category_id": category_id,
            "user_id": user_id,
            "description": description,
            "program_id": program_id,
            "file_name": file_name,
            "file_path": file_path,
            "source_url": source_url,
        },
    )
    document_id = result.lastrowid
    db.commit()
    return document_id


def _embed_and_insert_chunks(
    db: Session,
    document_id: int,
    chunks: list[dict],
    document_name: str = "",
    program_name: str = "",
) -> int:
    if not chunks:
        return 0

    texts = [
        clean_text(build_embedding_text(program_name, document_name, c["parent_text"]))
        for c in chunks
    ]

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
