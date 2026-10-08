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
    # Suggested heading level for review; 0 means no heading style was found.
    suggested_level: int = 0


_WORD_HEADING_STYLE_PATTERN = re.compile(r"heading\s*(\d+)", re.IGNORECASE)


def _style_to_heading_level(style_name: str | None) -> int:
    """Return the heading level from a Word style name, or 0 if not a heading."""
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
    """Yield document paragraphs and tables in their original XML order."""
    parent_elm = doc.element.body
    for child in parent_elm.iterchildren():
        if child.tag.endswith("}p"):
            yield Paragraph(child, doc)
        elif child.tag.endswith("}tbl"):
            yield Table(child, doc)


def parse_raw_docx(file_bytes: bytes) -> list[RawLine]:
    """Extract DOCX paragraphs and table rows in document order."""
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
    """Extract PDF text lines as paragraphs."""
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
    """Build text chunks using the manually selected heading levels."""
    mark_by_index = {m.line_index: m.level for m in marks}
    heading_stack: dict[int, str] = {}

    groups: list[tuple[tuple, list[str]]] = []
    current_lines: list[str] = []
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

    def _heading_str(heading: tuple) -> str:
        return " > ".join(heading) if heading else ""

    real_headings = {_heading_str(h) for h, body in groups if body}

    results: list[dict] = []
    for heading, body_lines in groups:
        heading_str = _heading_str(heading)

        if not body_lines:
            # Drop empty headings already represented by a content-bearing descendant.
            is_redundant = any(
                rh == heading_str or rh.startswith(heading_str + " > ")
                for rh in real_headings
            )
            if is_redundant:
                continue
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