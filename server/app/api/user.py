from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import get_current_user
from app.schemas.user import ProfileResponse, ProfileUpdateRequest, PasswordChangeRequest
from app.crud.user_crud import (
    get_profile,
    email_taken_by_other,
    update_profile,
    verify_current_password,
    update_password,
)

router = APIRouter(prefix="/api/user", tags=["User Profile"])


@router.get("/me", response_model=ProfileResponse)
def read_my_profile(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # ดึง user_id จาก JWT เท่านั้น ไม่รับ user_id จาก query/body
    # กันไม่ให้ใครสวมรอยดูข้อมูลโปรไฟล์คนอื่นได้แค่เดา id
    profile = get_profile(db, current_user["user_id"])
    if profile is None:
        raise HTTPException(status_code=404, detail="ไม่พบข้อมูลผู้ใช้")
    return profile


@router.put("/me", response_model=ProfileResponse)
def update_my_profile(
    body: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user["user_id"]

    if email_taken_by_other(db, user_id, body.email):
        raise HTTPException(status_code=400, detail="อีเมลนี้ถูกใช้งานแล้ว")

    update_profile(db, user_id, body.firstname, body.lastname, body.email)

    profile = get_profile(db, user_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="ไม่พบข้อมูลผู้ใช้")
    return profile


@router.put("/me/password")
def change_my_password(
    body: PasswordChangeRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user["user_id"]

    if not verify_current_password(db, user_id, body.current_password):
        raise HTTPException(status_code=400, detail="รหัสผ่านปัจจุบันไม่ถูกต้อง")

    update_password(db, user_id, body.new_password)
    return {"success": True}