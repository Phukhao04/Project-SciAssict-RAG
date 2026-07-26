from sqlalchemy import Column, Integer, String, Text
from app.db.session import Base


class DocumentCategory(Base):
    __tablename__ = "document_category"

    category_id = Column(Integer, primary_key=True, autoincrement=True)
    category_name = Column(String(100), nullable=False)
    description = Column(Text)
