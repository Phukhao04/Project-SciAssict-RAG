from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.admin import UserListItem, UserRoleUpdateRequest, RoleItem
from app.crud.admin_crud import (
    get_all_users,
    get_all_roles,
    update_user_role,
    delete_user,
)

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get("/users", response_model=list[UserListItem])
def list_users(db: Session = Depends(get_db)):
    return get_all_users(db)


@router.get("/roles", response_model=list[RoleItem])
def list_roles(db: Session = Depends(get_db)):
    """ให้ frontend ดึงไปสร้าง dropdown เปลี่ยนบทบาท แทนการ hardcode ป้ายชื่อ"""
    return get_all_roles(db)


@router.patch("/users/{user_id}")
def patch_user_role(
    user_id: int, body: UserRoleUpdateRequest, db: Session = Depends(get_db)
):
    updated = update_user_role(db, user_id, body.role_id)
    if not updated:
        raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้นี้ในระบบ")
    return {"success": True, "user_id": user_id, "role_id": body.role_id}


@router.delete("/users/{user_id}")
def remove_user(user_id: int, db: Session = Depends(get_db)):
    deleted = delete_user(db, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้นี้ในระบบ")
    return {"success": True, "user_id": user_id}