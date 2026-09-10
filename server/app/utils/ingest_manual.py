"""
Manual Heading Marking - ทางเลือกแทน Docling สำหรับ flow ที่แอดมิน
mark heading เองผ่าน UI แทนที่จะพึ่ง Word heading style + Docling
auto-detection

ทำไมไม่ใช้ Docling ในไฟล์นี้:
- Docling ถูกออกแบบมาให้ "เดา" heading จาก Word style ซึ่งเราไม่ต้องการ
  แบบนั้นอีกแล้ว (แอดมิน mark เองตรงๆ ผ่าน UI)
- เอาโค้ดมาซับซ้อนขึ้นโดยไม่จำเป็นถ้าต้องแปลง manual mark ให้เข้ารูป
  Docling chunk object ปลอมๆ

จุดที่ต้องระวัง (สืบทอดมาจากบั๊กเดิมที่เจอใน docling_pipeline.py):
- doc.paragraphs กับ doc.tables เป็นคนละ list ไม่เรียงตามลำดับจริง
  ในเอกสาร ถ้าอ่านแยกกันจะทำให้ heading กับตารางที่ควรอยู่คู่กันหลุด
  จากกัน (เป็น root cause ของ chunking failure ที่เจอมาก่อน) -
  แก้โดยเดิน document tree ตามลำดับจริงด้วย _iter_block_items()

รองรับ 2 ประเภทไฟล์ (เท่ากับที่ ingestion.py เดิมรองรับ):
- .docx -> parse_raw_docx() (อ่านผ่าน python-docx ตรงๆ)
- .pdf  -> parse_raw_pdf() (reuse extract_text_from_pdf() เดิมจาก
  extraction.py - ไม่เขียน PDF parser ใหม่ซ้ำ) PDF ไม่มีแนวคิดตาราง/
  paragraph แยกกันแบบ .docx เลยไม่มี kind="table_row" สำหรับ PDF
  ทุกบรรทัดถือเป็น "paragraph" เหมือนกันหมด - คุณภาพขึ้นกับ pypdf
  extraction เอง (ข้อจำกัดเดิมที่มีอยู่แล้ว ไม่ใช่ปัญหาใหม่จากไฟล์นี้)
"""

import io
import re
from dataclasses import dataclass

from docx import Document as DocxDocument
from docx.table import Table
from docx.text.paragraph import Paragraph

from .extraction import extract_text_from_pdf


@dataclass
class RawLine:
    index: int
    kind: str  # "paragraph" | "table_row"
    text: str
    # ถ้าไฟล์มี Word heading style (Heading 1/2/...) ติดมาอยู่แล้ว เก็บ
    # level ไว้เป็น "คำแนะนำเริ่มต้น" ให้ frontend pre-fill การ mark ให้
    # แอดมินตรวจสอบ/แก้ไขได้ ไม่ใช่ apply ตรงเข้า DB เลย - แอดมินยังต้อง
    # ตรวจสอบผ่าน UI เหมือนเดิมเป๊ะ (ต่างจาก Docling เดิมที่ auto-apply
    # โดยไม่มีจุดให้ตรวจสอบก่อน) ค่า 0 = ไม่มี style ให้อ้างอิง หรือเป็น
    # PDF ที่ไม่มีข้อมูล style ให้อ่านเลย
    suggested_level: int = 0


_WORD_HEADING_STYLE_PATTERN = re.compile(r"heading\s*(\d+)", re.IGNORECASE)


def _style_to_heading_level(style_name: str | None) -> int:
    """แปลงชื่อ Word style (เช่น 'Heading 1', 'Heading 2') เป็นเลข level
    คืน 0 ถ้าไม่ใช่ heading style (เช่น 'Normal', 'Title', ตัวหนาเฉยๆ)"""
    if not style_name:
        return 0
    match = _WORD_HEADING_STYLE_PATTERN.match(style_name.strip())
    if not match:
        return 0
    return int(match.group(1))


@dataclass
class HeadingMark:
    line_index: int
    level: int  # 1, 2, 3, ... (1 = ระดับบนสุด)


def _iter_block_items(doc: DocxDocument):
    """
    เดินตาม document body ตามลำดับ XML จริง (paragraph สลับ table
    ตามที่ปรากฏในไฟล์) แทนการอ่าน doc.paragraphs และ doc.tables
    แยกกันเป็นคนละ list
    """
    parent_elm = doc.element.body
    for child in parent_elm.iterchildren():
        if child.tag.endswith("}p"):
            yield Paragraph(child, doc)
        elif child.tag.endswith("}tbl"):
            yield Table(child, doc)


def parse_raw_docx(file_bytes: bytes) -> list[RawLine]:
    """
    อ่านไฟล์ .docx ดิบ ไม่สนใจ Word heading style ใดๆ เลย
    คืน list ของบรรทัดตามลำดับจริงในเอกสาร สำหรับให้ frontend
    render ให้แอดมิน mark heading level เอง

    Paragraph ว่างเปล่าถูกข้าม (ไม่มีประโยชน์ให้ mark)
    Table แต่ละแถวถูกรวมเป็น 1 บรรทัด คั่นด้วย " | " ต่อ cell
    (merged cell ที่ python-docx รายงานค่าเดิมซ้ำหลาย cell จะถูกตัด
    ให้เหลือ unique value ตามลำดับ)
    """
    doc = DocxDocument(io.BytesIO(file_bytes))
    lines: list[RawLine] = []
    idx = 0

    for block in _iter_block_items(doc):
        if isinstance(block, Paragraph):
            text = block.text.strip()
            if text:
                style_name = block.style.name if block.style else None
                suggested = _style_to_heading_level(style_name)
                lines.append(
                    RawLine(
                        index=idx,
                        kind="paragraph",
                        text=text,
                        suggested_level=suggested,
                    )
                )
                idx += 1
        elif isinstance(block, Table):
            for row in block.rows:
                cells = [c.text.strip() for c in row.cells]
                seen: list[str] = []
                for c in cells:
                    if c and (not seen or seen[-1] != c):
                        seen.append(c)
                text = " | ".join(seen)
                if text:
                    lines.append(RawLine(index=idx, kind="table_row", text=text))
                    idx += 1

    return lines


def parse_raw_pdf(file_bytes: bytes) -> list[RawLine]:
    """
    อ่านไฟล์ .pdf ดิบ - reuse extract_text_from_pdf() เดิมจาก
    extraction.py (pypdf) ตรงๆ ไม่เขียน PDF parser ใหม่ซ้ำ

    ต่างจาก parse_raw_docx() ตรงที่ PDF ไม่มีแนวคิดตาราง/paragraph
    แยกกันให้ pypdf บอกได้ ทุกบรรทัดที่ extract ได้ถือเป็น "paragraph"
    เหมือนกันหมด (kind="paragraph" เสมอ ไม่มี "table_row" สำหรับ PDF)
    """
    paragraphs = extract_text_from_pdf(file_bytes)
    lines: list[RawLine] = []
    idx = 0

    for _, text_line in paragraphs:
        text = text_line.strip()
        if text:
            lines.append(RawLine(index=idx, kind="paragraph", text=text))
            idx += 1

    return lines


def build_chunks_from_marks(
    lines: list[RawLine],
    marks: list[HeadingMark],
    max_chars: int = 1500,
) -> list[dict]:
    """
    แบ่ง chunk ตาม heading ที่แอดมินเลือก mark เอง

    Logic เทียบเท่ากับ _merge_chunks_by_heading ใน docling_pipeline.py
    แต่ heading มาจาก manual mark แทนการเดาจาก Word style ผ่าน Docling

    heading_stack เก็บ heading ปัจจุบันของแต่ละ level - เมื่อเจอ mark
    ระดับ N ใหม่ ต้องล้าง level ที่ลึกกว่า N ทิ้ง (heading ใหม่ตัดสาย
    heading ลูกของก้อนก่อนหน้า) แต่คง level ที่ตื้นกว่าไว้ (เช่น mark
    heading level 2 ใหม่ ไม่กระทบ heading level 1 ที่ครอบอยู่)
    """
    mark_by_index = {m.line_index: m.level for m in marks}
    heading_stack: dict[int, str] = {}

    groups: list[tuple[tuple, list[str]]] = []
    current_lines: list[str] = []
    # เดิม flush_group() บันทึกกลุ่มเฉพาะตอน current_lines ไม่ว่างเปล่า -
    # ทำให้ heading ที่ไม่มีเนื้อหาใต้เลย (เช่น mark heading ติดกันหลายอัน
    # โดยไม่มีบรรทัดเนื้อหาคั่นระหว่างกลาง) หายไปเงียบๆ ทั้งที่ marks ที่
    # ส่งมาไม่ได้ว่างเปล่า ถ้าเกิดกับทุก heading พร้อมกัน results จะกลาย
    # เป็น [] ทั้งที่ควรมีอย่างน้อย 1 chunk - has_current_heading ใช้เช็ค
    # แยกว่า "มี heading ที่ยังไม่ได้ flush อยู่ไหม" เพื่อไม่ให้หลุดกรณีนี้
    has_current_heading = False

    def current_heading_tuple() -> tuple:
        return tuple(heading_stack[lvl] for lvl in sorted(heading_stack))

    def flush_group():
        nonlocal has_current_heading
        if current_lines or has_current_heading:
            groups.append((current_heading_tuple(), list(current_lines)))
            current_lines.clear()
        has_current_heading = False

    for line in lines:
        if line.index in mark_by_index:
            level = mark_by_index[line.index]
            flush_group()
            for lvl in list(heading_stack):
                if lvl >= level:
                    del heading_stack[lvl]
            heading_stack[level] = line.text
            has_current_heading = True
        else:
            current_lines.append(line.text)

    flush_group()

    results: list[dict] = []
    for heading, body_lines in groups:
        heading_str = " > ".join(heading) if heading else ""

        if not body_lines:
            # heading ไม่มีเนื้อหาใต้เลย - ใช้ heading เองเป็นเนื้อหาแทน
            # ปล่อย chunk_text ว่างเปล่า (ว่างเปล่าไม่มีประโยชน์ตอน embed
            # และ heading tuple ว่างพร้อม body ว่างจะไม่มีทางเกิดขึ้นได้อยู่
            # แล้วจาก logic ด้านบน จึงไม่ต้องกัน heading_str ว่างซ้ำอีก)
            results.append({"chunk_text": heading_str, "parent_text": heading_str})
            continue

        batch: list[str] = []
        batch_len = 0

        def flush_batch():
            if not batch:
                return
            body = "\n".join(batch)
            parent = f"{heading_str}\n{body}" if heading_str else body
            results.append({"chunk_text": body, "parent_text": parent})

        for bline in body_lines:
            if batch and batch_len + len(bline) > max_chars:
                flush_batch()
                batch, batch_len = [], 0
            batch.append(bline)
            batch_len += len(bline) + 1

        flush_batch()

    return results