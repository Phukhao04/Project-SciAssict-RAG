from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

# 1) connection string บอก SQLAlchemy ว่าจะต่อ DB แบบไหน (mysql+pymysql)
#    ไปที่ไหน (host:port) ด้วย user/password/database อะไร
DATABASE_URL = (
    f"mysql+pymysql://{settings.TIDB_USER}:{settings.TIDB_PASSWORD}"
    f"@{settings.TIDB_HOST}:{settings.TIDB_PORT}/{settings.TIDB_DATABASE}"
    f"?ssl_verify_cert=true"
)

# 2) engine คือ "ตัวจัดการ connection pool" ทั้งหมด
#    pool_pre_ping=True   -> เช็ค connection ว่ายังไม่ตายก่อนใช้งานทุกครั้ง
#    pool_recycle=280     -> ทิ้ง connection เก่าทุก 280 วิ ก่อน TiDB จะตัดเอง (280 < 300 ที่ TiDB มักตั้งไว้)
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=280)

# 3) SessionLocal คือ "โรงงานผลิต session" เรียกทีไรได้ session ใหม่ทุกที
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4) Base คือ "แม่แบบ" ที่ทุก model (Role, User, Document ฯลฯ) ต้องสืบทอด
#    ทำให้ SQLAlchemy รู้ว่า class ไหนคือตาราง
Base = declarative_base()


def get_db():
    """
    ทำไมต้องเป็น generator (ใช้ yield ไม่ใช่ return):
    เพราะเราต้องการโค้ดที่รันหลัง endpoint ใช้งานเสร็จแล้วเสมอ (ปิด session)
    ไม่ว่า endpoint จะสำเร็จหรือ error ก็ตาม

    ถ้าใช้ return ธรรมดา ฟังก์ชันจะจบทันทีตอน return
    ไม่มีโอกาสกลับมารันโค้ดหลังจากนั้น (โค้ดใน finally จะไม่มีทางถูกเรียก)

    แต่ yield ทำให้ฟังก์ชัน "หยุดชั่วคราว" ส่ง session ออกไปให้ endpoint ใช้ก่อน
    พอ endpoint ใช้เสร็จ (ไม่ว่า return ปกติหรือ error) โค้ดจะย้อนกลับมาทำงานต่อ
    จากบรรทัดถัดจาก yield นั่นคือส่วน finally: db.close()

    FastAPI รู้จัก pattern นี้อยู่แล้ว (ผ่าน Depends()) เลยจัดการเรื่องนี้ให้อัตโนมัติ
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()