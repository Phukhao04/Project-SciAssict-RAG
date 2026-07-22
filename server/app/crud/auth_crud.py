from sqlalchemy import text
from sqlalchemy.orm import Session
from app.utils.security import get_current_date_for_token, hash_password


def check_authen_request(db: Session, authen_request: str):
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


def username_exists(db: Session, username: str) -> bool:
    sql = text("SELECT 1 FROM user WHERE username = :username")
    return db.execute(sql, {"username": username}).first() is not None


def create_user(
    db: Session,
    username: str,
    password: str,
    email: str,
    role_id: str,
    firstname: str | None = None,
    lastname: str | None = None,
) -> dict:
    hashed = hash_password(password)

    insert_sql = text("""
        INSERT INTO user (username, password, email, role_id, firstname, lastname)
        VALUES (:username, :password, :email, :role_id, :firstname, :lastname)
    """)
    result = db.execute(
        insert_sql,
        {
            "username": username,
            "password": hashed,
            "email": email,
            "role_id": role_id,
            "firstname": firstname,
            "lastname": lastname,
        },
    )
    db.commit()
    return {"user_id": result.lastrowid, "username": username, "email": email}