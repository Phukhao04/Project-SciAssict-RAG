import io
import re

from docx import Document as DocxDocument
from docling.backend.msword_backend import MsWordDocumentBackend
from docling.datamodel.base_models import InputFormat
from docling.datamodel.document import InputDocument
from docling_core.transforms.chunker.hierarchical_chunker import HierarchicalChunker


# pattern เดียวกับที่ extraction.py เดิมใช้เป็น fallback - เก็บไว้ที่นี่
# เพราะตอนนี้ทำหน้าที่เป็น "ตัวรักษาไฟล์ก่อนส่งเข้า Docling" แทน
FALLBACK_HEADING_PATTERN = re.compile(r"ปีที่\s*\d+.*ภาคการศึกษาที่\s*\d+")


def heal_heading_styles(file_bytes: bytes) -> tuple[bytes, int]:
    doc = DocxDocument(io.BytesIO(file_bytes))
    fixed_count = 0

    for paragraph in doc.paragraphs:
        style = paragraph.style
        is_heading_style = (
            style is not None and style.name.lower().startswith("heading")
        )
        if not is_heading_style and FALLBACK_HEADING_PATTERN.search(paragraph.text):
            paragraph.style = doc.styles["Heading 1"]
            fixed_count += 1

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue(), fixed_count


def _chunk_to_lines(chunk) -> list[str]:
    lines: list[str] = []
    text_parts: list[str] = []

    def flush_text_parts():
        if text_parts:
            lines.append(" ".join(text_parts))
            text_parts.clear()

    for item in chunk.meta.doc_items:
        text = getattr(item, "text", None)
        if text is not None:
            if text.strip():
                text_parts.append(text.strip())
            continue

        table_data = getattr(item, "data", None)
        if table_data is not None and hasattr(table_data, "table_cells"):
            flush_text_parts()
            for cell in table_data.table_cells:
                if cell.text and cell.text.strip():
                    lines.append(cell.text.strip())

    flush_text_parts()
    return lines


def _merge_chunks_by_heading(chunks, max_chars: int = 1500) -> list[dict]:
    groups: list[tuple[tuple, list[str]]] = []
    current_heading: tuple | None = None
    current_lines: list[str] = []

    for chunk in chunks:
        heading = tuple(chunk.meta.headings) if chunk.meta.headings else ()
        if heading != current_heading:
            if current_lines:
                groups.append((current_heading, current_lines))
            current_heading = heading
            current_lines = []
        current_lines.extend(_chunk_to_lines(chunk))

    if current_lines:
        groups.append((current_heading, current_lines))

    results: list[dict] = []
    for heading, lines in groups:
        heading_str = " > ".join(heading) if heading else ""
        batch: list[str] = []
        batch_len = 0

        def flush_batch():
            if not batch:
                return
            body = "\n".join(batch)
            parent = f"{heading_str}\n{body}" if heading_str else body
            results.append({"chunk_text": body, "parent_text": parent})

        for line in lines:
            if batch and batch_len + len(line) > max_chars:
                flush_batch()
                batch, batch_len = [], 0
            batch.append(line)
            batch_len += len(line) + 1

        flush_batch()

    return results


def process_docx(file_bytes: bytes, document_name: str) -> list[dict]:
    healed_bytes, _ = heal_heading_styles(file_bytes)

    stream = io.BytesIO(healed_bytes)
    in_doc = InputDocument(
        path_or_stream=stream,
        format=InputFormat.DOCX,
        backend=MsWordDocumentBackend,
        filename=document_name,
    )
    backend = MsWordDocumentBackend(in_doc, path_or_stream=stream)
    dl_doc = backend.convert()

    chunker = HierarchicalChunker()
    raw_chunks = list(chunker.chunk(dl_doc))

    return _merge_chunks_by_heading(raw_chunks)