from sqlalchemy import text
from sqlalchemy.orm import Session

from app.utils.security import hash_password


def get_profile(db: Session, user_id: int) -> dict | None:
    """Return a user's profile with its role name."""
    sql = text("""
        SELECT u.user_id, u.username, u.email, u.role_id, r.role_name,
               u.firstname, u.lastname
        FROM user u
        JOIN role r ON u.role_id = r.role_id
        WHERE u.user_id = :user_id
    """)
    row = db.execute(sql, {"user_id": user_id}).first()
    if row is None:
        return None
    return {
        "user_id": row.user_id,
        "username": row.username,
        "email": row.email,
        "role_id": row.role_id,
        "role_name": row.role_name,
        "firstname": row.firstname,
        "lastname": row.lastname,
    }


def email_taken_by_other(db: Session, user_id: int, email: str) -> bool:
    """Check whether another user already uses the email."""
    sql = text("SELECT 1 FROM user WHERE email = :email AND user_id != :user_id")
    return db.execute(sql, {"email": email, "user_id": user_id}).first() is not None


def update_profile(
    db: Session,
    user_id: int,
    firstname: str | None,
    lastname: str | None,
    email: str,
) -> bool:
    sql = text("""
        UPDATE user
        SET firstname = :firstname, lastname = :lastname, email = :email
        WHERE user_id = :user_id
    """)
    result = db.execute(
        sql,
        {
            "firstname": firstname,
            "lastname": lastname,
            "email": email,
            "user_id": user_id,
        },
    )
    db.commit()
    return result.rowcount > 0


def verify_current_password(db: Session, user_id: int, current_password: str) -> bool:
    """Check the supplied password against the stored hash."""
    hashed = hash_password(current_password)
    sql = text("SELECT 1 FROM user WHERE user_id = :user_id AND password = :hashed")
    return db.execute(sql, {"user_id": user_id, "hashed": hashed}).first() is not None


def update_password(db: Session, user_id: int, new_password: str) -> None:
    hashed = hash_password(new_password)
    sql = text("UPDATE user SET password = :password WHERE user_id = :user_id")
    db.execute(sql, {"password": hashed, "user_id": user_id})
    db.commit()