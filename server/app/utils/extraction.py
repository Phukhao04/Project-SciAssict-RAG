"""
Text extraction จากไฟล์ PDF และ Word (.docx)
วางที่ server/app/utils/extraction.py

ต้องลง dependency เพิ่ม:
    pip install pypdf python-docx
"""
import io

from pypdf import PdfReader
from docx import Document as DocxDocument


class UnsupportedFileTypeError(Exception):
    pass


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """แปลง PDF (bytes) เป็นข้อความล้วน รวมทุกหน้า"""
    reader = PdfReader(io.BytesIO(file_bytes))
    pages_text = []
    for page in reader.pages:
        text = page.extract_text() or ""
        if text.strip():
            pages_text.append(text)
    return "\n".join(pages_text)


def extract_page_range(file_bytes: bytes, start_page: int, end_page: int) -> str:
    """
    แปลงเฉพาะช่วงหน้าที่ระบุเป็นข้อความ (1-indexed, inclusive ทั้งสองด้าน)
    ใช้เลือกเฉพาะหมวด/ส่วนที่ต้องการจากเอกสารยาวๆ โดยไม่ต้องแก้ไฟล์ต้นฉบับ
    """
    reader = PdfReader(io.BytesIO(file_bytes))
    total_pages = len(reader.pages)
    start = max(1, start_page)
    end = min(total_pages, end_page)

    pages_text = []
    for i in range(start - 1, end):
        text = reader.pages[i].extract_text() or ""
        if text.strip():
            pages_text.append(text)
    return "\n".join(pages_text)


def extract_text_from_docx(file_bytes: bytes) -> str:
    """แปลง Word (.docx) เป็นข้อความล้วน รวม paragraph และตาราง"""
    doc = DocxDocument(io.BytesIO(file_bytes))

    parts = []
    for para in doc.paragraphs:
        if para.text.strip():
            parts.append(para.text)

    # ดึงข้อความจากตารางด้วย (เอกสารราชการ/คู่มือมักมีตารางข้อมูลสำคัญ)
    for table in doc.tables:
        for row in table.rows:
            row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
            if row_text:
                parts.append(row_text)

    return "\n".join(parts)


def extract_text(filename: str, file_bytes: bytes) -> str:
    """
    เลือกวิธี extract ตามนามสกุลไฟล์
    รองรับ: .pdf, .docx
    """
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""

    if ext == "pdf":
        return extract_text_from_pdf(file_bytes)
    elif ext == "docx":
        return extract_text_from_docx(file_bytes)
    else:
        raise UnsupportedFileTypeError(
            f"ไม่รองรับไฟล์นามสกุล .{ext} (รองรับเฉพาะ .pdf, .docx)"
        )