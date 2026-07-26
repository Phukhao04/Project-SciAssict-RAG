from sqlalchemy import text
from sqlalchemy.orm import Session


def get_all_users(db: Session) -> list[dict]:
    # JOIN ตาราง role เพื่อดึง role_name จริงมาแสดง แทนการ hardcode ฝั่ง frontend
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
    return db.execute(
        text("SELECT COUNT(*) FROM user WHERE role_id = 'admin'")
    ).scalar() or 0


def update_user_role(db: Session, user_id: int, role_id: str) -> bool:
    """
    คืนค่า True ถ้าสำเร็จ, False ถ้าไม่พบ user
    Raise ValueError ถ้าเป็นการลด role คนที่เป็น admin คนสุดท้ายในระบบ
    (ต้องเช็คก่อน UPDATE จริง ไม่งั้นระบบจะไม่มี admin เหลือเลย
    และไม่มีทาง recover ผ่าน UI ต้องเข้าไปแก้ SQL ตรงๆ)
    """
    row = db.execute(
        text("SELECT role_id FROM user WHERE user_id = :id"), {"id": user_id}
    ).first()
    if row is None:
        return False

    if row.role_id == "admin" and role_id != "admin":
        if _count_admins(db) <= 1:
            raise ValueError("ไม่สามารถลดสิทธิ์ได้ เนื่องจากเป็นผู้ดูแลระบบคนสุดท้ายในระบบ")

    # ป้องกัน role_id ที่ไม่มีอยู่จริงในตาราง role (กัน FK constraint error ดิบๆ)
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
    """
    คืนค่า True ถ้าสำเร็จ, False ถ้าไม่พบ user
    Raise ValueError ถ้าจะลบ admin คนสุดท้ายในระบบ
    """
    row = db.execute(
        text("SELECT role_id FROM user WHERE user_id = :id"), {"id": user_id}
    ).first()
    if row is None:
        return False

    if row.role_id == "admin" and _count_admins(db) <= 1:
        raise ValueError("ไม่สามารถลบผู้ใช้ได้ เนื่องจากเป็นผู้ดูแลระบบคนสุดท้ายในระบบ")

    # ลบแถวที่มี FK ชี้มาที่ user_id ก่อนเสมอ (messages, chatsession, document_chunk, document)
    # ไม่งั้น DELETE FROM user จะชนกับ foreign key constraint
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