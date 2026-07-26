from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from app.db.session import Base


class ChatSession(Base):
    __tablename__ = "chatsession"

    session_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("user.user_id"), nullable=False)
    session_title = Column(String(255))
    created_at = Column(TIMESTAMP, server_default=func.now())
