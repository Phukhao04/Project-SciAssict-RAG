from sqlalchemy import text
from sqlalchemy.orm import Session
from app.utils.security import get_current_date_for_token


def check_authen_request(db: Session, authen_request: str):
    """หา user ที่ SHA2(username & date, 256) ตรงกับ authen_request ที่ client ส่งมา
    เทียบเท่า checkAuthenRequest ใน user_account.js
    """
    date_str = get_current_date_for_token()

    sql = text("""
        SELECT user_id, username
        FROM user
        WHERE SHA2(CONCAT(username, '&', :date_str), 256) = :authen_request
    """)
    row = db.execute(sql, {"date_str": date_str, "authen_request": authen_request}).first()

    if row is None:
        return {"is_error": True, "error_message": "ไม่พบข้อมูลผู้ใช้ในระบบ"}
    return {
        "is_error": False,
        "data": {"user_id": row.user_id, "username": row.username},
    }


def check_access_request(db: Session, authen_signature: str, authen_token: str):
    """หา user ที่ SHA2(username & password & authen_token, 256) ตรงกับ authen_signature
    เทียบเท่า checkAccessRequest ใน user_account.js
    หมายเหตุ: column `password` ในตาราง user เก็บเป็นค่าที่ hash ด้วย SHA256 มาแล้วจากฝั่ง client
    """
    sql = text("""
        SELECT user_id, username, email, firstname, lastname, role_id
        FROM user
        WHERE SHA2(CONCAT(username, '&', password, '&', :authen_token), 256) = :authen_signature
    """)
    row = db.execute(
        sql, {"authen_token": authen_token, "authen_signature": authen_signature}
    ).first()

    if row is None:
        return {"is_error": True, "error_message": "รหัสผ่านไม่ถูกต้อง"}

    return {
        "is_error": False,
        "data": {
            "user_id": row.user_id,
            "username": row.username,
            "email": row.email,
            "firstname": row.firstname,
            "lastname": row.lastname,
            "role_id": row.role_id,
        },
    }