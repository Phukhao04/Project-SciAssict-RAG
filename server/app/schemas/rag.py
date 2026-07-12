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
  
class ChatResponse(BaseModel):
  answer: str
  sources: list[str] = Field(default_factory=list)