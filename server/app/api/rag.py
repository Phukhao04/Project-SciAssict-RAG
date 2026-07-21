"""
RAG API endpoints
ทำไมไฟล์นี้ "บาง" (ไม่มี logic เยอะ): เพราะ logic จริงอยู่ใน utils/ หมดแล้ว
ไฟล์นี้มีหน้าที่แค่ "รับ request -> เรียก utils -> ส่ง response" เท่านั้น
"""
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.rag import ChatRequest, ChatResponse, IngestRequest, IngestResponse
from app.utils.extraction import UnsupportedFileTypeError, extract_text
from app.utils.ingestion import ingest_document
from app.utils.llm import generate_answer
from app.utils.retrieval import retrieve
from app.crud.chat_crud import create_session, save_message

router = APIRouter(prefix="/api/rag", tags=["RAG"])

MAX_FILE_SIZE_MB = 20


@router.post("/documents/upload", response_model=IngestResponse)
async def upload_document(
    file: UploadFile = File(...),
    document_name: str = Form(...),
    category_id: int = Form(...),
    user_id: int = Form(...),
    description: str | None = Form(default=None),
    db: Session = Depends(get_db),
):
    """
    รับไฟล์ PDF/Word โดยตรง -> extract text -> hierarchical_chunk -> embed -> insert
    ทำไมไม่ส่ง level_patterns เข้ามาตอนนี้: endpoint นี้ยังเป็นแบบ "ทั่วไป"
    (ไม่รู้โครงสร้างเอกสารล่วงหน้า) จึงปล่อยให้ hierarchical_chunk ถอยไปทำงาน
    แบบ recursive_split เพียงอย่างเดียว เหมือน text ธรรมดา
    ถ้าจะรองรับเอกสารมีโครงสร้างเฉพาะ (เช่น หลักสูตร) ค่อยทำ endpoint แยกที่รับ
    level_patterns หรือเดาประเภทเอกสารจาก document_name/content ในอนาคต
    """
    file_bytes = await file.read()
    size_mb = len(file_bytes) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(status_code=413, detail=f"ไฟล์ใหญ่เกิน {MAX_FILE_SIZE_MB}MB")

    try:
        full_text = extract_text(file.filename, file_bytes)
    except UnsupportedFileTypeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not full_text.strip():
        raise HTTPException(
            status_code=400,
            detail="ไม่พบข้อความในไฟล์ (อาจเป็นไฟล์สแกน/รูปภาพ ที่ต้องใช้ OCR)",
        )

    document_type = file.filename.lower().rsplit(".", 1)[-1]

    try:
        result = ingest_document(
            db,
            full_text=full_text,
            document_name=document_name,
            document_type=document_type,
            category_id=category_id,
            user_id=user_id,
            description=description,
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=400, detail="ไม่สามารถบันทึกเอกสารได้ กรุณาตรวจสอบข้อมูลที่ส่งมา"
        ) from exc

    return IngestResponse(**result)


@router.post("/documents/ingest", response_model=IngestResponse)
def ingest(payload: IngestRequest, db: Session = Depends(get_db)):
    try:
        result = ingest_document(
            db,
            full_text=payload.text,
            document_name=payload.document_name,
            document_type=payload.document_type,
            category_id=payload.category_id,
            user_id=payload.user_id,
            description=payload.description,
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="ไม่สามารถบันทึกเอกสารได้ กรุณาตรวจสอบข้อมูลที่ส่งมา") from exc

    return IngestResponse(**result)


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, db: Session = Depends(get_db)):
    session_id = payload.session_id
    if session_id is None:
        # ยังไม่มี session -> สร้างใหม่ ใช้คำถามแรกเป็นชื่อ session
        session_id = create_session(db, payload.user_id, payload.question)

    try:
        chunks = retrieve(db, payload.question, k=payload.k)
        answer = generate_answer(db, payload.question, k=payload.k, retrieved=chunks)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="ระบบตอบคำถามขัดข้องชั่วคราว กรุณาลองใหม่") from exc

    # บันทึกทั้งคำถามและคำตอบลง messages อัตโนมัติ
    save_message(db, session_id, payload.user_id, "user", payload.question)
    save_message(db, session_id, payload.user_id, "bot", answer)

    sources = list({c.document_name for c in chunks})
    return ChatResponse(answer=answer, sources=sources, session_id=session_id)