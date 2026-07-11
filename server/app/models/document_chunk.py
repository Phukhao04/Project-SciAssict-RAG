from sqlalchemy import Column, Integer, Text, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.types import UserDefinedType
from app.db.session import Base

class Vector(UserDefinedType):
    def __init__(self, dim):
        self.dim = dim

    def get_col_spec(self, **kw):
        return f"VECTOR({self.dim})"

class DocumentChunk(Base):
    __tablename__ = "document_chunk"

    chunk_id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(Integer, ForeignKey("document.document_id"), nullable=False)
    chunk_text = Column(Text, nullable=False)
    embedding_vector = Column(Vector(384))  # 384 = มิติของ all-MiniLM-L6-v2
    created_at = Column(TIMESTAMP, server_default=func.now())