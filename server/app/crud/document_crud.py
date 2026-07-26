"""
CRUD สำหรับ document_category
แยกไฟล์นี้ออกมาต่างหาก เพราะ chat_crud.py มีหน้าที่เกี่ยวกับ session/messages
ล้วนๆ อยู่แล้ว ไม่อยากยัดของที่ไม่เกี่ยวกันเข้าไฟล์เดียว
"""

from sqlalchemy import text
from sqlalchemy.orm import Session
from datetime import date, timedelta

THAI_WEEKDAY_SHORT = [
    "จ",
    "อ",
    "พ",
    "พฤ",
    "ศ",
    "ส",
    "อา",
]  # date.weekday(): 0=จันทร์ ... 6=อาทิตย์


def get_all_categories(db: Session) -> list[dict]:
    sql = text("""
        SELECT category_id, category_name
        FROM document_category
        ORDER BY category_id
    """)
    rows = db.execute(sql).fetchall()
    return [
        {"category_id": r.category_id, "category_name": r.category_name} for r in rows
    ]


def get_all_documents(db: Session) -> list[dict]:
    sql = text("""
        SELECT
            d.document_id,
            d.document_name,
            d.document_type,
            dcat.category_name,
            d.upload_date,
            COUNT(chunk.chunk_id) AS chunks_count
        FROM document d
        JOIN document_category dcat
            ON d.category_id = dcat.category_id
        LEFT JOIN document_chunk chunk
            ON chunk.document_id = d.document_id
        GROUP BY
            d.document_id,
            d.document_name,
            d.document_type,
            dcat.category_name,
            d.upload_date
        ORDER BY d.upload_date DESC
    """)
    rows = db.execute(sql).fetchall()
    return [
        {
            "document_id": r.document_id,
            "document_name": r.document_name,
            "document_type": r.document_type,
            "category_name": r.category_name,
            "upload_date": r.upload_date,
            "chunks_count": r.chunks_count,
        }
        for r in rows
    ]


def delete_document(db: Session, document_id: int) -> bool:
    """
    ลบ chunk ก่อนเสมอ (child) แล้วค่อยลบ document (parent)
    ทำไมไม่พึ่ง ON DELETE CASCADE: FK ของ document_chunk ในโมเดลปัจจุบัน
    ชี้ผิดคอลัมน์ (document.docment_id ที่ไม่มีจริง) เลยไม่กล้าพึ่งพฤติกรรม
    cascade ของ DB ตรงๆ จนกว่าจะแก้ constraint ให้ถูก ลบเองด้วยโค้ดชัวร์กว่า
    """
    exists = db.execute(
        text("SELECT 1 FROM document WHERE document_id = :id"),
        {"id": document_id},
    ).first()
    if exists is None:
        return False

    db.execute(
        text("DELETE FROM document_chunk WHERE document_id = :id"),
        {"id": document_id},
    )
    db.execute(
        text("DELETE FROM document WHERE document_id = :id"),
        {"id": document_id},
    )
    db.commit()
    return True


def get_document_detail(db: Session, document_id: int) -> dict | None:
    doc_sql = text("""
        SELECT
            d.document_id,
            d.document_name,
            d.document_type,
            dcat.category_name,
            d.upload_date
        FROM document d
        JOIN document_category dcat
            ON d.category_id = dcat.category_id
        WHERE d.document_id = :document_id
    """)
    doc_row = db.execute(doc_sql, {"document_id": document_id}).first()

    if doc_row is None:
        return None

    # ORDER BY chunk_id ใช้แทนลำดับต้นฉบับ เพราะ document_chunk ไม่มี
    # คอลัมน์ลำดับเก็บไว้จริงๆ - ใช้ได้เพราะ ingestion insert เรียงตามลำดับ chunk เดิม
    chunks_sql = text("""
        SELECT chunk_id, chunk_text
        FROM document_chunk
        WHERE document_id = :document_id
        ORDER BY chunk_id ASC
    """)
    chunk_rows = db.execute(chunks_sql, {"document_id": document_id}).fetchall()

    return {
        "document_id": doc_row.document_id,
        "document_name": doc_row.document_name,
        "document_type": doc_row.document_type,
        "category_name": doc_row.category_name,
        "upload_date": doc_row.upload_date,
        "chunks": [
            {"chunk_id": r.chunk_id, "chunk_text": r.chunk_text} for r in chunk_rows
        ],
    }


def _to_buddhist_date_str(d: date) -> str:
    return f"{d.day:02d}/{d.month:02d}/{d.year + 543}"


def get_stats(db: Session) -> dict:
    total_documents = db.execute(text("SELECT COUNT(*) FROM document")).scalar() or 0
    total_chunks = db.execute(text("SELECT COUNT(*) FROM document_chunk")).scalar() or 0
    questions_today = db.execute(text("""
            SELECT COUNT(*) FROM messages
            WHERE sender_role = 'user' AND DATE(timestamp) = CURDATE()
        """)).scalar() or 0

    return {
        "total_documents": total_documents,
        "total_chunks": total_chunks,
        "questions_today": questions_today,
    }


def get_query_activity(db: Session, weeks: int = 13) -> list[dict]:
    """
    คืนค่าคงที่ 13 สัปดาห์ (91 วัน) ย้อนหลังจากวันนี้เสมอ (91 หาร 7 ลงตัวพอดี)
    เติมวันที่ไม่มีคำถามเลยด้วย count=0 (zero-fill) เพื่อให้กราฟกลุ่มสัปดาห์
    ฝั่ง frontend เรียงถูกต้องเสมอ ไม่ขึ้นกับว่า DB มีข้อมูลจริงตั้งแต่วันไหน
    """
    days_count = weeks * 7
    today = date.today()
    start_date = today - timedelta(days=days_count - 1)

    sql = text("""
        SELECT DATE(timestamp) AS day, COUNT(*) AS cnt
        FROM messages
        WHERE sender_role = 'user'
          AND DATE(timestamp) >= :start_date
        GROUP BY DATE(timestamp)
    """)
    rows = db.execute(sql, {"start_date": start_date}).fetchall()
    counts_by_day = {r.day: r.cnt for r in rows}

    result = []
    for i in range(days_count):
        d = start_date + timedelta(days=i)
        result.append(
            {
                "day": THAI_WEEKDAY_SHORT[d.weekday()],
                "date": _to_buddhist_date_str(d),
                "count": counts_by_day.get(d, 0),
            }
        )
    return result
