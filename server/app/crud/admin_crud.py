from sqlalchemy import text
from sqlalchemy.orm import Session

ADMIN_ROLE_ID = "R01"


def get_all_users(db: Session) -> list[dict]:
    sql = text("""
        SELECT
            u.user_id, u.username, u.email, u.role_id,
            r.role_name,
            u.firstname, u.lastname
        FROM user u
        JOIN role r ON u.role_id = r.role_id
        ORDER BY u.user_id
    """)
    rows = db.execute(sql).fetchall()
    return [
        {
            "user_id": r.user_id,
            "username": r.username,
            "email": r.email,
            "role_id": r.role_id,
            "role_name": r.role_name,
            "firstname": r.firstname,
            "lastname": r.lastname,
        }
        for r in rows
    ]


def get_all_roles(db: Session) -> list[dict]:
    sql = text("SELECT role_id, role_name FROM role ORDER BY role_id")
    rows = db.execute(sql).fetchall()
    return [{"role_id": r.role_id, "role_name": r.role_name} for r in rows]


def _count_admins(db: Session) -> int:
    count = db.execute(
        text("SELECT COUNT(*) FROM user WHERE role_id = :admin_role"),
        {"admin_role": ADMIN_ROLE_ID},
    ).scalar()
    return count or 0


def update_user_role(db: Session, user_id: int, role_id: str) -> bool:
    """Update a user's role, preserving at least one admin account."""
    row = db.execute(
        text("SELECT role_id FROM user WHERE user_id = :id"), {"id": user_id}
    ).first()
    if row is None:
        return False

    if row.role_id == ADMIN_ROLE_ID and role_id != ADMIN_ROLE_ID:
        if _count_admins(db) <= 1:
            raise ValueError("ไม่สามารถลดสิทธิ์ได้ เนื่องจากเป็นผู้ดูแลระบบคนสุดท้ายในระบบ")

    role_exists = db.execute(
        text("SELECT 1 FROM role WHERE role_id = :role_id"), {"role_id": role_id}
    ).first()
    if role_exists is None:
        raise ValueError(f"ไม่พบบทบาท '{role_id}' ในระบบ")

    db.execute(
        text("UPDATE user SET role_id = :role_id WHERE user_id = :id"),
        {"role_id": role_id, "id": user_id},
    )
    db.commit()
    return True


def delete_user(db: Session, user_id: int) -> bool:
    """Delete a user and related records, preserving at least one admin."""
    row = db.execute(
        text("SELECT role_id FROM user WHERE user_id = :id"), {"id": user_id}
    ).first()
    if row is None:
        return False

    if row.role_id == ADMIN_ROLE_ID and _count_admins(db) <= 1:
        raise ValueError("ไม่สามารถลบผู้ใช้ได้ เนื่องจากเป็นผู้ดูแลระบบคนสุดท้ายในระบบ")

    db.execute(text("DELETE FROM messages WHERE user_id = :id"), {"id": user_id})
    db.execute(text("DELETE FROM chatsession WHERE user_id = :id"), {"id": user_id})
    db.execute(
        text("""
            DELETE FROM document_chunk
            WHERE document_id IN (SELECT document_id FROM document WHERE user_id = :id)
        """),
        {"id": user_id},
    )
    db.execute(text("DELETE FROM document WHERE user_id = :id"), {"id": user_id})
    db.execute(text("DELETE FROM user WHERE user_id = :id"), {"id": user_id})
    db.commit()
    return True