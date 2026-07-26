from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.auth import (
    AuthenRequestBody,
    AccessRequestBody,
    AuthResponse,
    RegisterRequest,
    RegisterResponse,
)
from app.crud.auth_crud import (
    check_authen_request,
    check_access_request,
    create_user,
    username_exists,
)
from app.utils.security import sign_token, verify_token, get_current_date_for_token

router = APIRouter(prefix="/api/authen", tags=["authentication"])


@router.post("/register", response_model=RegisterResponse)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if username_exists(db, body.username):
        raise HTTPException(status_code=400, detail="ชื่อผู้ใช้นี้ถูกใช้ไปแล้ว")

    try:
        result = create_user(
            db,
            username=body.username,
            password=body.password,
            email=body.email,
            role_id=body.role_id,
            firstname=body.firstname,
            lastname=body.lastname,
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=400, detail="ไม่สามารถสมัครสมาชิกได้ กรุณาตรวจสอบข้อมูล"
        ) from exc

    return RegisterResponse(**result)


@router.post(
    "/authen_request", response_model=AuthResponse, response_model_by_alias=True
)
def authen_request(body: AuthenRequestBody, db: Session = Depends(get_db)):
    result = check_authen_request(db, body.authen_request)
    if result["is_error"]:
        return AuthResponse(
            is_error=True, data="", error_message=result["error_message"]
        )
    payload = {
        "user_id": result["data"]["user_id"],
        "username": result["data"]["username"],
    }
    authen_token = sign_token(payload)
    return AuthResponse(is_error=False, data=authen_token, error_message="")


@router.post(
    "/access_request", response_model=AuthResponse, response_model_by_alias=True
)
def access_request(body: AccessRequestBody, db: Session = Depends(get_db)):
    decoded = verify_token(body.authen_token)
    if decoded is None:
        return AuthResponse(is_error=True, data="", error_message="ข้อมูลไม่ถูกต้อง")

    result = check_access_request(db, body.authen_signature, body.authen_token)
    if result["is_error"]:
        return AuthResponse(
            is_error=True, data="", error_message=result["error_message"]
        )

    user_data = result["data"]
    payload = {
        "user_id": user_data["user_id"],
        "username": user_data["username"],
        "role_id": user_data["role_id"],
        "date": get_current_date_for_token(),
    }
    access_token = sign_token(payload)
    return AuthResponse(
        is_error=False,
        data={
            "access_token": access_token,
            "user_id": user_data["user_id"],
            "username": user_data["username"],
            "firstname": user_data["firstname"],
            "lastname": user_data["lastname"],
            "role_id": user_data["role_id"],
        },
        error_message="",
    )
