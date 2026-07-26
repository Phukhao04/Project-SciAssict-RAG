from pydantic import BaseModel, Field


class IngestRequest(BaseModel):
    text: str = Field(..., min_length=1)
    document_name: str
    document_type: str = Field(..., max_length=10)
    category_id: int
    user_id: int
    description: str | None = None


class IngestResponse(BaseModel):
    document_id: int
    chunks_inserted: int


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1)
    k: int = Field(default=5, ge=1, le=20)
    user_id: int
    session_id: int | None = None  # None = ให้ backend สร้าง session ใหม่อัตโนมัติ


class ChatResponse(BaseModel):
    answer: str
    sources: list[str] = Field(default_factory=list)
    session_id: int  # ส่งกลับเสมอ (ใหม่หรือเดิมก็ตาม) ให้ frontend เอาไปใช้ครั้งถัดไป


class CategoryResponse(BaseModel):
    category_id: int
    category_name: str


from datetime import datetime


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