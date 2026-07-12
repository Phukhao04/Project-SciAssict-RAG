from sqlalchemy import Column, Integer, Text, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from app.db.session import Base

class Message(Base):
  __tablename__ = "messages"
  
  message_id = Column(Integer, primary_key=True, autoincrement=True)
  session_id = Column(Integer, ForeignKey("chatsession.session_id"), nullable=False)
  user_id = Column(Integer, ForeignKey("user.user_id"), nullable=False)
  message_text = Column(Text, nullable=False)
  timestamp = Column(TIMESTAMP, server_default=func.now())