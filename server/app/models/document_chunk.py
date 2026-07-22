from sqlalchemy import Column, Integer, Text, TIMESTAMP, ForeignKey
from sqlalchemy import func
from app.db.session import Base

class DocumentChunk(Base):
  __tablename__ = "document_chunk"
  
  chunk_id = Column(Integer, primary_key=True, autoincrement=True)
  document_id = Column(Integer, ForeignKey("document.docment_id"), nullable=False)
  chunk_text = Column(Text, nullable=False)
  embedding_vector = Column(Text)
  create_at = Column(TIMESTAMP, server_default=func.now())