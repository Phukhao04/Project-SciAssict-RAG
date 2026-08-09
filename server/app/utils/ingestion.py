"""
Ingestion pipeline (v3 - ใช้ Docling สำหรับ .docx + แก้ /documents/ingest ให้ใช้งานได้จริง)

หน้าที่
1. บันทึกข้อมูลเอกสาร
2. แปลง + chunk เอกสาร (.docx ผ่าน Docling, .pdf ผ่าน pypdf เดิม, raw text ผ่าน line-split)
3. สร้าง Embedding จาก parent_text (เนื้อหา + heading context)
4. บันทึกลงฐานข้อมูล (schema เดิมทุกคอลัมน์ ไม่ต้องแก้ DB)

v3 เปลี่ยนจาก v2:
- แยก insert_document_row() และ embed_and_insert_chunks() ออกมาเป็น
  helper กลาง เพราะตอนนี้มี 2 เส้นทางเข้ามาที่ต้องใช้ร่วมกัน:
  ingest_document() (จากไฟล์ .pdf/.docx) กับ ingest_text() (จาก raw text
  ที่ endpoint /documents/ingest ส่งมา ไม่มีไฟล์จริงให้ extract)
- เดิม endpoint /documents/ingest เรียก ingest_document(paragraphs=...)
  ซึ่งพังทันที เพราะ signature ของ ingest_document() ตอน migrate ไป
  Docling เปลี่ยนไปรับ filename+file_bytes แล้ว ไม่มี paragraphs อีกต่อไป
  ตอนนี้แยกฟังก์ชันให้ชัดเจนแทน ไม่ยัดสองเคสเข้าฟังก์ชันเดียวอีก
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


def clean_text(raw: str) -> str:
    """ทำความสะอาดข้อความก่อนสร้าง Embedding"""
    raw = raw.replace("\u00a0", " ")
    raw = raw.replace("\t", " ")
    raw = re.sub(r"\n{3,}", "\n\n", raw)
    raw = re.sub(r"[ ]{2,}", " ", raw)
    return raw.strip()


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


def _get_chunks_for_text(raw_text: str, document_name: str) -> list[dict]:
    """
    สำหรับ endpoint /documents/ingest (รับ text ดิบ ไม่ใช่ไฟล์)
    ไม่มี heading style ให้อ่านเหมือน .docx เลยตัดง่ายสุด: 1 บรรทัดไม่ว่าง
    = 1 chunk (เหมือนแนวทางเดียวกับ PDF fallback ด้านบน เพื่อให้ตรรกะ
    การ chunk ของทั้งระบบ predictable เหมือนกันในทุกเส้นทาง)
    """
    return [
        {"chunk_text": line.strip(), "parent_text": f"{document_name}\n{line.strip()}"}
        for line in raw_text.split("\n")
        if line.strip()
    ]


def _insert_document_row(
    db: Session,
    document_name: str,
    document_type: str,
    category_id: int,
    user_id: int,
    description: str | None,
) -> int:
    """Insert แถวใน `document` แล้วคืน document_id ที่ได้ - ใช้ร่วมกันทั้ง
    เส้นทางไฟล์และเส้นทาง raw text"""
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
    """Embed แล้ว insert chunk ทั้งหมดลง document_chunk - ใช้ร่วมกันทั้ง
    เส้นทางไฟล์และเส้นทาง raw text คืนจำนวน chunk ที่ insert สำเร็จ"""
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
    เส้นทางไฟล์ (.pdf / .docx) - ใช้กับ endpoint /documents/upload
    รับ filename + file_bytes ตรงๆ เพราะ Docling ต้องการ bytes ดิบไปแปลง
    เป็น DoclingDocument เอง
    """
    document_id = _insert_document_row(
        db, document_name, document_type, category_id, user_id, description
    )

    chunks = _get_chunks_for_file(filename, file_bytes, document_name)
    chunks_inserted = _embed_and_insert_chunks(db, document_id, chunks)

    return {"document_id": document_id, "chunks_inserted": chunks_inserted}


def ingest_text(
    db: Session,
    raw_text: str,
    document_name: str,
    document_type: str,
    category_id: int,
    user_id: int,
    description: str | None = None,
) -> dict:
    """
    เส้นทาง raw text (ไม่มีไฟล์จริง) - ใช้กับ endpoint /documents/ingest
    เดิม endpoint นี้เรียก ingest_document(paragraphs=...) ซึ่งพังเพราะ
    signature ไม่ตรงกันแล้ว ตอนนี้แยกฟังก์ชันเฉพาะให้ชัดเจน
    """
    document_id = _insert_document_row(
        db, document_name, document_type, category_id, user_id, description
    )

    chunks = _get_chunks_for_text(raw_text, document_name)
    chunks_inserted = _embed_and_insert_chunks(db, document_id, chunks)

    return {"document_id": document_id, "chunks_inserted": chunks_inserted}