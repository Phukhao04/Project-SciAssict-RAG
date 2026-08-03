"""
Ingestion pipeline

หน้าที่
1. บันทึกข้อมูลเอกสาร
2. แบ่งเอกสารเป็น Parent/Child chunks (v3: parent-child จาก Heading Style ของ Word)
3. สร้าง Embedding จาก "child" chunk เท่านั้น (เล็ก โฟกัส ค้นหาแม่นกว่า)
4. บันทึกทั้ง child (สำหรับ embed) และ parent (สำหรับส่งให้ LLM อ่าน) ลงฐานข้อมูล
"""

import json
import re

from sqlalchemy import text
from sqlalchemy.orm import Session

from .hierarchical_chunking import chunk_by_headings_parent_child
from .embedding import get_embedder


def clean_text(text: str) -> str:
    """ทำความสะอาดข้อความก่อนสร้าง Embedding"""
    text = text.replace("\u00a0", " ")
    text = text.replace("\t", " ")

    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ ]{2,}", " ", text)

    return text.strip()


def ingest_document(
    db: Session,
    paragraphs: list[tuple[int | None, str]],
    document_name: str,
    document_type: str,
    category_id: int,
    user_id: int,
    description: str | None = None,
    parent_max_chars: int = 1200,
    parent_overlap_chars: int = 100,
    child_max_chars: int = 200,
    child_overlap_chars: int = 30,
) -> dict:
    """
    paragraphs: list ของ (heading_level, text) จาก app.utils.extraction.extract_text()
                heading_level=None คือเนื้อหาปกติ, 1/2/3/... คือ Heading ระดับนั้นจาก Word
    """

    # -----------------------------
    # 1) Insert Document
    # -----------------------------

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

    # -----------------------------
    # 2) Chunk (parent-child)
    # -----------------------------

    parents, children = chunk_by_headings_parent_child(
        paragraphs,
        parent_max_chars=parent_max_chars,
        parent_overlap_chars=parent_overlap_chars,
        child_max_chars=child_max_chars,
        child_overlap_chars=child_overlap_chars,
        header_prefix=document_name,
    )

    if not children:
        return {
            "document_id": document_id,
            "chunks_inserted": 0,
        }

    # เอาไว้ค้น parent.text จาก parent_index ตอน insert แต่ละ child
    parent_text_by_index = {p.parent_index: p.text for p in parents}

    # -----------------------------
    # 3) Prepare Text สำหรับ Embedding (ใช้ child เท่านั้น)
    # -----------------------------

    texts = []

    for child in children:
        path_str = " > ".join(child.path) if child.path else ""
        doc_context = f"{document_name}" + (f" | {path_str}" if path_str else "")

        text_for_embedding = clean_text(f"""
เอกสาร : {doc_context}

เนื้อหา :

{child.text}
""")
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
    # 5) Insert Chunks (child_text + parent_text คู่กัน)
    # -----------------------------

    insert_chunk_sql = text("""
        INSERT INTO document_chunk
        (document_id, chunk_text, parent_text, embedding_vector, created_at)
        VALUES
        (:document_id, :chunk_text, :parent_text, :embedding_vector, NOW())
        """)

    for child, embedding in zip(children, embeddings):
        db.execute(
            insert_chunk_sql,
            {
                "document_id": document_id,
                "chunk_text": child.text,
                "parent_text": parent_text_by_index[child.parent_index],
                "embedding_vector": json.dumps(embedding),
            },
        )

    db.commit()

    return {
        "document_id": document_id,
        "chunks_inserted": len(children),
    }
