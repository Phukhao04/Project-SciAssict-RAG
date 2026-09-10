from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import get_current_user
from app.schemas.chat import SessionResponse, MessageResponse
from app.crud.chat_crud import (
    get_sessions_by_user,
    get_messages_by_session,
    get_session_owner,
)

router = APIRouter(prefix="/api/chat", tags=["Chat History"])


@router.get("/sessions", response_model=list[SessionResponse])
def list_sessions(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # ดึง user_id จาก JWT เท่านั้น ไม่รับจาก URL/client เพื่อกัน IDOR
    # (แพทเทิร์นเดียวกับ /api/user/me)
    return get_sessions_by_user(db, current_user["user_id"])


@router.get("/sessions/{session_id}/messages", response_model=list[MessageResponse])
def list_messages(
    session_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    owner_id = get_session_owner(db, session_id)
    if owner_id is None:
        raise HTTPException(status_code=404, detail="ไม่พบบทสนทนานี้")
    if owner_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="คุณไม่มีสิทธิ์เข้าถึงบทสนทนานี้")
    return get_messages_by_session(db, session_id)