from fastapi import Depends, HTTPException, Header
from app.utils.security import verify_token


def get_current_user(authorization: str = Header(default="")):
    """
    ดึงข้อมูลผู้ใช้จาก JWT access_token ใน header
    รูปแบบที่ต้องส่งมา: Authorization: Bearer <access_token>
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="กรุณาเข้าสู่ระบบ")

    token = authorization.removeprefix("Bearer ").strip()
    payload = verify_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่")

    return payload  # dict: user_id, username, role_id, date


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """ใช้เป็น Depends() ใน endpoint ที่ต้องจำกัดเฉพาะ role admin เท่านั้น"""
    if current_user.get("role_id") != "admin":
        raise HTTPException(status_code=403, detail="ต้องมีสิทธิ์ผู้ดูแลระบบเท่านั้น")
    return current_user