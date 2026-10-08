from pydantic import BaseModel


class RawLineOut(BaseModel):
    index: int
    kind: str
    text: str
    suggested_level: int = 0


class ParseRawResponse(BaseModel):
    lines: list[RawLineOut]
    file_token: str


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
    description: str | None = None
    source_url: str | None = None
    file_name: str
    file_token: str
    program_id: int | None = None
