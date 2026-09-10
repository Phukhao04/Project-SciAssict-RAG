"""
รวม router ทั้งหมดไว้ที่เดียว เพื่อให้ main.py แค่ import list เดียวแล้ว loop
include ไม่ต้องแก้ main.py ทุกครั้งที่เพิ่ม endpoint กลุ่มใหม่
"""

from app.api.auth import router as auth_router
from app.api.user import router as user_router
from app.api.chat import router as chat_router
from app.api.admin import router as admin_router
from app.api.rag import router as rag_router
from app.api.manual_ingest import router as manual_ingest_router

all_routers = [
    auth_router,
    user_router,
    chat_router,
    admin_router,
    rag_router,
    manual_ingest_router,
]
