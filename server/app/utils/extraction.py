"""
Text extraction จากไฟล์ PDF และ Word (.docx)
ทำไมต้องมีไฟล์นี้: ไฟล์ PDF/Word เก็บข้อมูลเป็น binary format (ไม่ใช่ text ธรรมดา)
ต้องใช้ library เฉพาะทางแกะโครงสร้างไฟล์ออกมาเป็นข้อความก่อน ถึงจะเอาไป chunk ต่อได้

ต้องลง dependency เพิ่ม: pip install pypdf python-docx
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
        page_text = page.extract_text() or ""
        if page_text.strip():
            pages_text.append(page_text)
    return "\n".join(pages_text)


def extract_text_from_docx(file_bytes: bytes) -> str:
    """แปลง Word (.docx) เป็นข้อความล้วน รวม paragraph และตาราง"""
    doc = DocxDocument(io.BytesIO(file_bytes))

    parts = []
    for para in doc.paragraphs:
        if para.text.strip():
            parts.append(para.text)

    # ดึงข้อความจากตารางด้วย (เอกสารราชการ/หลักสูตรมักมีตารางข้อมูลสำคัญ)
    for table in doc.tables:
        for row in table.rows:
            row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
            if row_text:
                parts.append(row_text)

    return "\n".join(parts)


def extract_text(filename: str, file_bytes: bytes) -> str:
    """เลือกวิธี extract ตามนามสกุลไฟล์ รองรับ .pdf, .docx"""
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""

    if ext == "pdf":
        return extract_text_from_pdf(file_bytes)
    elif ext == "docx":
        return extract_text_from_docx(file_bytes)
    else:
        raise UnsupportedFileTypeError(
            f"ไม่รองรับไฟล์นามสกุล .{ext} (รองรับเฉพาะ .pdf, .docx)"
        )