from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.chat import SessionResponse, MessageResponse
from app.crud.chat_crud import get_sessions_by_user, get_messages_by_session

router = APIRouter(prefix="/api/chat", tags=["Chat History"])


@router.get("/sessions/{user_id}", response_model=list[SessionResponse])
def list_sessions(user_id: int, db: Session = Depends(get_db)):
    return get_sessions_by_user(db, user_id)


@router.get("/sessions/{session_id}/messages", response_model=list[MessageResponse])
def list_messages(session_id: int, db: Session = Depends(get_db)):
    return get_messages_by_session(db, session_id)
