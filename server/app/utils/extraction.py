"""
Text extraction สำหรับไฟล์ PDF เท่านั้น

(.docx ย้ายไปใช้ app/utils/docling_pipeline.py ทั้งหมดแล้ว - ไม่มี DOCX
logic เหลืออยู่ในไฟล์นี้อีก กันสับสนว่าโค้ดไหนยังใช้งานจริง)

PDF ยังใช้ pypdf เดิม ไม่เปลี่ยนไปใช้ Docling เพราะ Docling ต้องพึ่ง
backend หนัก (torch, docling-ibm-models, OCR) เฉพาะตอนอ่าน PDF ที่ไม่มี
โครงสร้าง XML ให้อ่านตรงๆ เหมือน DOCX ต้องใช้ vision model ช่วยเข้าใจ
layout - ไม่คุ้มที่จะแบกรับ dependency หนักขนาดนั้นแค่เพื่อ PDF
"""

import io

from pypdf import PdfReader


def extract_text_from_pdf(file_bytes: bytes) -> list[tuple[int | None, str]]:
    """
    คืน list[(level, text)] เพื่อให้ signature เดิมเหมือนเดิม (level เป็น
    None เสมอ เพราะ PDF ไม่มี heading style ให้อ่านจริง)
    """
    reader = PdfReader(io.BytesIO(file_bytes))
    result: list[tuple[int | None, str]] = []
    for page in reader.pages:
        page_text = page.extract_text() or ""
        for line in page_text.split("\n"):
            if line.strip():
                result.append((None, line.strip()))
    return result