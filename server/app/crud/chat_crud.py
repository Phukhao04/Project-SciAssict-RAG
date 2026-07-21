from sqlalchemy import text
from sqlalchemy.orm import Session


def create_session(db: Session, user_id: int, title: str) -> int:
    """สร้าง session ใหม่ ตัด title ยาวเกินไปให้สั้นลง (กันเปลืองพื้นที่/อ่านง่าย)"""
    short_title = title[:50] + ("..." if len(title) > 50 else "")
    insert_sql = text("""
        INSERT INTO chatsession (user_id, session_title, created_at)
        VALUES (:user_id, :session_title, NOW())
    """)
    result = db.execute(insert_sql, {"user_id": user_id, "session_title": short_title})
    db.commit()
    return result.lastrowid


def get_sessions_by_user(db: Session, user_id: int) -> list[dict]:
    sql = text("""
        SELECT session_id, session_title, created_at
        FROM chatsession
        WHERE user_id = :user_id
        ORDER BY created_at DESC
    """)
    rows = db.execute(sql, {"user_id": user_id}).fetchall()
    return [
        {"session_id": r.session_id, "session_title": r.session_title, "created_at": r.created_at}
        for r in rows
    ]


def get_messages_by_session(db: Session, session_id: int) -> list[dict]:
    sql = text("""
        SELECT message_id, sender_role, message_text, timestamp
        FROM messages
        WHERE session_id = :session_id
        ORDER BY timestamp ASC
    """)
    rows = db.execute(sql, {"session_id": session_id}).fetchall()
    return [
        {
            "message_id": r.message_id,
            "sender_role": r.sender_role,
            "message_text": r.message_text,
            "timestamp": r.timestamp,
        }
        for r in rows
    ]


def save_message(db: Session, session_id: int, user_id: int, sender_role: str, text_content: str):
    insert_sql = text("""
        INSERT INTO messages (session_id, user_id, sender_role, message_text, timestamp)
        VALUES (:session_id, :user_id, :sender_role, :message_text, NOW())
    """)
    db.execute(
        insert_sql,
        {
            "session_id": session_id,
            "user_id": user_id,
            "sender_role": sender_role,
            "message_text": text_content,
        },
    )
    db.commit()