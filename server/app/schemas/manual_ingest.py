"""
Schemas สำหรับ manual heading marking flow (api/manual_ingest.py)
เดิม schema พวกนี้ถูกประกาศ inline อยู่ในไฟล์ router — ย้ายมารวมที่ app/schemas/
ให้เหมือน router อื่นๆ ที่ import schema จากที่นี่หมด
"""

from pydantic import BaseModel


class RawLineOut(BaseModel):
    index: int
    kind: str
    text: str
    suggested_level: int = 0


class ParseRawResponse(BaseModel):
    lines: list[RawLineOut]


class HeadingMarkIn(BaseModel):
    line_index: int
    level: int


class BuildChunksRequest(BaseModel):
    lines: list[RawLineOut]
    marks: list[HeadingMarkIn]


class ChunkPreview(BaseModel):
    chunk_text: str
    parent_text: str


class BuildChunksResponse(BaseModel):
    chunks: list[ChunkPreview]


class ConfirmManualIngestRequest(BaseModel):
    chunks: list[ChunkPreview]
    document_name: str
    document_type: str
    category_id: int
    user_id: int
    description: str | None = None
