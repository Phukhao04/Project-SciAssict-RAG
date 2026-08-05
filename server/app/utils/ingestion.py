"""
Ingestion pipeline (v2 - ใช้ Docling สำหรับ .docx)

หน้าที่
1. บันทึกข้อมูลเอกสาร
2. แปลง + chunk เอกสาร (.docx ผ่าน Docling, .pdf ผ่าน pypdf เดิม)
3. สร้าง Embedding จาก parent_text (เนื้อหา + heading context)
4. บันทึกลงฐานข้อมูล (schema เดิมทุกคอลัมน์ ไม่ต้องแก้ DB)

เปลี่ยนจาก v1 (parent-child เขียนเอง) เป็น v2 (Docling HierarchicalChunker):
ไม่มี parent/child แยก 2 ระดับอีกต่อไป เพราะ chunk ที่ได้จาก Docling
ขนาดพอดีอยู่แล้ว (1 element ต่อ chunk) - chunk_text และ parent_text
เลยมาจาก chunk เดียวกัน (คนละรูปแบบ: ดิบ vs มี context นำหน้า) ไม่ใช่
คนละขนาดเหมือนระบบเดิม
"""

import json
import re

from sqlalchemy import text
from sqlalchemy.orm import Session

from .docling_pipeline import process_docx
from .extraction import extract_text_from_pdf  # ของเดิม ยังใช้กับ PDF
from .embedding import get_embedder


class UnsupportedFileTypeError(Exception):
    """ย้ายมาจาก extraction.py เดิม - จุดเช็คนามสกุลไฟล์ตอนนี้อยู่ที่
    _get_chunks_for_file() ในไฟล์นี้แทน (extraction.py เหลือแค่ PDF แล้ว
    ไม่มีจุดตัดสินใจเรื่องนามสกุลไฟล์อยู่ในนั้นอีกต่อไป)"""

    pass


def clean_text(text: str) -> str:
    """ทำความสะอาดข้อความก่อนสร้าง Embedding"""
    text = text.replace("\u00a0", " ")
    text = text.replace("\t", " ")
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ ]{2,}", " ", text)
    return text.strip()


def _get_chunks_for_file(
    filename: str, file_bytes: bytes, document_name: str
) -> list[dict]:
    """
    เลือกวิธี chunk ตามนามสกุลไฟล์
    .docx -> Docling (HierarchicalChunker ผ่านโครงสร้างเอกสารจริง)
    .pdf  -> fallback ง่ายๆ: 1 บรรทัดที่ extract ได้ = 1 chunk (PDF ไม่มี
             โครงสร้าง heading ให้ Docling backend อ่านแบบเบาได้เหมือน DOCX
             ถ้าต้องการ heading detection ที่ดีสำหรับ PDF ด้วย ต้องใช้
             Docling backend เต็ม (ต้องมี torch) - ไม่ได้รวมไว้ในเวอร์ชันนี้
             เพื่อเลี่ยง dependency หนัก ตามที่ตัดสินใจไว้)
    """
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""

    if ext == "docx":
        return process_docx(file_bytes, document_name)

    elif ext == "pdf":
        paragraphs = extract_text_from_pdf(file_bytes)
        return [
            {"chunk_text": text_line, "parent_text": f"{document_name}\n{text_line}"}
            for _, text_line in paragraphs
            if text_line.strip()
        ]

    else:
        raise UnsupportedFileTypeError(
            f"ไม่รองรับไฟล์นามสกุล .{ext} (รองรับเฉพาะ .pdf, .docx)"
        )


def ingest_document(
    db: Session,
    filename: str,
    file_bytes: bytes,
    document_name: str,
    document_type: str,
    category_id: int,
    user_id: int,
    description: str | None = None,
) -> dict:
    """
    v2: รับ filename + file_bytes ตรงๆ (ไม่ใช่ paragraphs ที่ extract มาก่อน
    แล้วเหมือน v1) เพราะ Docling ต้องการ bytes ดิบไปแปลงเป็น DoclingDocument
    เอง - endpoint ฝั่ง api/rag.py ต้องแก้ให้ส่ง filename, file_bytes เข้ามา
    แทนการเรียก extract_text() แยกต่างหากก่อนเหมือนเดิม
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
    # 2) Chunk
    # -----------------------------
    chunks = _get_chunks_for_file(filename, file_bytes, document_name)

    if not chunks:
        return {"document_id": document_id, "chunks_inserted": 0}

    # -----------------------------
    # 3) Prepare Text สำหรับ Embedding (ใช้ parent_text - มี context นำหน้า)
    # -----------------------------
    texts = [clean_text(c["parent_text"]) for c in chunks]

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

    return {
        "document_id": document_id,
        "chunks_inserted": len(chunks),
    }