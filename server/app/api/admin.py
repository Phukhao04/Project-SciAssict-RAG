from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.crud.admin_crud import (
    delete_user,
    get_all_roles,
    get_all_users,
    update_user_role,
)
from app.db.session import get_db
from app.schemas.admin import RoleItem, UserListItem, UserRoleUpdateRequest

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get(
    "/users",
    response_model=list[UserListItem],
    dependencies=[Depends(require_admin)],
)
def list_users(db: Session = Depends(get_db)):
    return get_all_users(db)


@router.get(
    "/roles",
    response_model=list[RoleItem],
    dependencies=[Depends(require_admin)],
)
def list_roles(db: Session = Depends(get_db)):
    return get_all_roles(db)


@router.patch("/users/{user_id}", dependencies=[Depends(require_admin)])
def patch_user_role(
    user_id: int,
    body: UserRoleUpdateRequest,
    db: Session = Depends(get_db),
):
    try:
        updated = update_user_role(db, user_id, body.role_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not updated:
        raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้นี้ในระบบ")
    return {"success": True, "user_id": user_id, "role_id": body.role_id}


@router.delete("/users/{user_id}", dependencies=[Depends(require_admin)])
def remove_user(
    user_id: int,
    db: Session = Depends(get_db),
):
    try:
        deleted = delete_user(db, user_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not deleted:
        raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้นี้ในระบบ")
    return {"success": True, "user_id": user_id}