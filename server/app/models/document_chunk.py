from sqlalchemy import Column, Integer, Text, TIMESTAMP, ForeignKey
from sqlalchemy import func
from app.db.session import Base


class DocumentChunk(Base):
    __tablename__ = "document_chunk"

    chunk_id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(Integer, ForeignKey("document.document_id"), nullable=False)
    chunk_text = Column(Text, nullable=False)  # "child" text -> ใช้ตอน embed/ค้นหาเท่านั้น
    parent_text = Column(Text, nullable=False)  # "parent" text (ทั้ง section) -> ส่งให้ LLM อ่านตอบ
    embedding_vector = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())