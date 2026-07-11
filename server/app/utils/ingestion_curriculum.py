"""
Ingestion เฉพาะทางสำหรับเอกสารหลักสูตร (มคอ.2)
- เลือก extract เฉพาะ section/หน้าที่ต้องการ (ไม่ต้องแก้ไฟล์ต้นฉบับ)
- ใช้ chunking strategy ต่างกันตามประเภทเนื้อหาในแต่ละ section
"""
import json
from dataclasses import dataclass
from sqlalchemy import text
from sqlalchemy.orm import Session

from .chunking import chunk_text
from .chunking_curriculum import chunk_course_descriptions, chunk_curriculum
from .embedding import embed_batch
from .extraction import extract_page_range


@dataclass
class SectionConfig:
    start_page: int
    end_page: int
    chunk_mode: str  # "prose" | "curriculum" | "course"
    label: str  # ใช้แปะเป็น context prefix ในแต่ละ chunk


def ingest_curriculum_pdf(
    db: Session,
    file_bytes: bytes,
    document_name: str,
    category_id: int,
    user_id: int,
    sections: list[SectionConfig],
    description: str | None = None,
) -> dict:
    """
    รับไฟล์ PDF หลักสูตร -> extract เฉพาะ section ที่กำหนด -> chunk ตามประเภทเนื้อหา -> insert เข้า DB

    ตัวอย่างการเรียกใช้:
        sections = [
            SectionConfig(4, 9, "prose", "หมวด 1 ข้อมูลทั่วไป"),
            SectionConfig(10, 11, "prose", "หมวด 2 ปรัชญา/วัตถุประสงค์"),
            SectionConfig(12, 22, "curriculum", "หมวด 3 โครงสร้างหลักสูตร"),
            SectionConfig(43, 43, "prose", "หมวด 6 คุณสมบัติผู้เข้าเรียน"),
            SectionConfig(44, 44, "prose", "หมวด 7 เกณฑ์ประเมิน/จบการศึกษา"),
            SectionConfig(88, 176, "course", "คำอธิบายรายวิชา"),
        ]
        result = ingest_curriculum_pdf(db, pdf_bytes, "หลักสูตรเคมี 2569", category_id=1, user_id=1, sections=sections)
    """
    # 1) insert เข้า document ก่อน เพื่อได้ document_id มาใช้เป็น FK
    insert_doc_sql = text(
        """
        INSERT INTO document (document_name, document_type, category_id, user_id, upload_date, description)
        VALUES (:document_name, 'pdf', :category_id, :user_id, NOW(), :description)
        """
    )
    result = db.execute(
        insert_doc_sql,
        {
            "document_name": document_name,
            "category_id": category_id,
            "user_id": user_id,
            "description": description,
        },
    )
    document_id = result.lastrowid

    insert_chunk_sql = text(
        """
        INSERT INTO document_chunk (document_id, chunk_text, embedding_vector, created_at)
        VALUES (:document_id, :chunk_text, :embedding_vector, NOW())
        """
    )

    total_chunks = 0
    section_summary = []

    for section in sections:
        section_text = extract_page_range(file_bytes, section.start_page, section.end_page)
        if not section_text.strip():
            continue

        # เลือก chunking strategy ตามประเภทเนื้อหา
        if section.chunk_mode == "curriculum":
            chunks = chunk_curriculum(section_text, header_prefix=f"{document_name} | {section.label}")
            texts = [c.text for c in chunks]
        elif section.chunk_mode == "course":
            chunks = chunk_course_descriptions(section_text, header_prefix=f"{document_name} | {section.label}")
            texts = [c.text for c in chunks]
        else:  # prose (default)
            plain_chunks = chunk_text(section_text, max_chars=500, overlap_sentences=1)
            texts = [f"{document_name} | {section.label}\n{c.text}" for c in plain_chunks]

        if not texts:
            continue

        embeddings = embed_batch(texts)
        for chunk_text_str, embedding in zip(texts, embeddings):
            db.execute(
                insert_chunk_sql,
                {
                    "document_id": document_id,
                    "chunk_text": chunk_text_str,
                    "embedding_vector": json.dumps(embedding),
                },
            )

        total_chunks += len(texts)
        section_summary.append({"label": section.label, "chunks": len(texts)})

    db.commit()
    return {
        "document_id": document_id,
        "chunks_inserted": total_chunks,
        "sections": section_summary,
    }


# ตัวอย่างการตั้งค่า section สำหรับเอกสารหลักสูตรเคมี 2569 (จาก page range ที่หาไว้)
CHEMISTRY_2569_SECTIONS = [
    SectionConfig(4, 9, "prose", "หมวด 1 ข้อมูลทั่วไป"),
    SectionConfig(10, 11, "prose", "หมวด 2 ปรัชญา วัตถุประสงค์ และผลลัพธ์การเรียนรู้"),
    SectionConfig(12, 22, "curriculum", "หมวด 3 โครงสร้างหลักสูตร/แผนการศึกษา"),
    SectionConfig(43, 43, "prose", "หมวด 6 คุณสมบัติผู้เข้าศึกษา"),
    SectionConfig(44, 44, "prose", "หมวด 7 การประเมินผลและเกณฑ์การสำเร็จการศึกษา"),
    SectionConfig(88, 176, "course", "คำอธิบายรายวิชา"),
]