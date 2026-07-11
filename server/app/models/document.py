from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from app.db.session import Base

class Document(Base):
    __tablename__ = "document"

    document_id = Column(Integer, primary_key=True, autoincrement=True)
    document_name = Column(String(255), nullable=False)
    document_type = Column(String(10))
    category_id = Column(Integer, ForeignKey("document_category.category_id"))
    user_id = Column(Integer, ForeignKey("user.user_id"), nullable=False)
    upload_date = Column(TIMESTAMP, server_default=func.now())
    description = Column(Text)
    # updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    # ↑ เพิ่มไว้เผื่อ ถ้าเล่มระบุว่า admin แก้ไขเอกสารได้ ให้ uncomment บรรทัดนี้