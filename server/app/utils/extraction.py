import io

from pypdf import PdfReader


def extract_text_from_pdf(file_bytes: bytes) -> list[tuple[int | None, str]]:
    reader = PdfReader(io.BytesIO(file_bytes))
    result: list[tuple[int | None, str]] = []
    for page in reader.pages:
        page_text = page.extract_text() or ""
        for line in page_text.split("\n"):
            if line.strip():
                result.append((None, line.strip()))
    return result