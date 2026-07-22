from pydantic import BaseModel
from datetime import datetime


class SessionResponse(BaseModel):
    session_id: int
    session_title: str | None
    created_at: datetime


class MessageResponse(BaseModel):
    message_id: int
    sender_role: str
    message_text: str
    timestamp: datetime
