from datetime import datetime

from pydantic import BaseModel, Field


class IngestResponse(BaseModel):
    document_id: int
    chunks_inserted: int


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1)
    k: int = Field(default=5, ge=1, le=20)
    user_id: int
    session_id: int | None = None


class ChatResponse(BaseModel):
    answer: str
    sources: list[str] = Field(default_factory=list)
    session_id: int


class CategoryCreateRequest(BaseModel):
    category_name: str = Field(..., min_length=1, max_length=255)


class CategoryResponse(BaseModel):
    category_id: int
    category_name: str


class DocumentListItem(BaseModel):
    document_id: int
    document_name: str
    document_type: str
    category_name: str
    upload_date: datetime
    chunks_count: int


class DocumentChunkItem(BaseModel):
    chunk_id: int
    chunk_text: str
    parent_text: str


class UpdateChunkRequest(BaseModel):
    chunk_text: str = Field(..., min_length=1)


class DocumentDetailResponse(BaseModel):
    document_id: int
    document_name: str
    document_type: str
    category_name: str
    upload_date: datetime
    chunks: list[DocumentChunkItem]


class StatsResponse(BaseModel):
    total_documents: int
    total_chunks: int
    questions_today: int


class QueryActivityItem(BaseModel):
    day: str
    date: str
    count: int
