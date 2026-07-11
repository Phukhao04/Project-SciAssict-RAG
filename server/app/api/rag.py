"""
RAG API endpoints
วางที่ server/app/api/rag.py

หมายเหตุ: ปรับ import path (`app.xxx`) ให้ตรงกับโครงสร้างจริงของโปรเจกต์
ถ้า schemas อยู่ที่ server/app/schemas/rag.py และ session อยู่ที่ server/app/db/session.py
"""
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.rag import ChatRequest, ChatResponse, IngestRequest, IngestResponse
from app.utils.extraction import UnsupportedFileTypeError, extract_text
from app.utils.ingestion import ingest_document
from app.utils.llm import generate_answer
from app.utils.retrieval import retrieve

router = APIRouter(prefix="/rag", tags=["RAG"])

MAX_FILE_SIZE_MB = 20


from app.utils.ingestion_curriculum import CHEMISTRY_2569_SECTIONS, ingest_curriculum_pdf


@router.post("/documents/upload-curriculum", response_model=IngestResponse)
async def upload_curriculum(
    file: UploadFile = File(...),
    document_name: str = Form(...),
    category_id: int = Form(...),
    user_id: int = Form(...),
    description: str | None = Form(default=None),
    db: Session = Depends(get_db),
):
    """
    รับไฟล์ PDF หลักสูตร (มคอ.2) -> extract เฉพาะ section ที่กำหนดไว้ล่วงหน้า
    -> chunk ตามประเภทเนื้อหา (prose/curriculum/course) -> insert เข้า DB

    หมายเหตุ: ตอนนี้ hardcode section เป็นของหลักสูตรเคมี 2569 ไว้ก่อน
    ถ้าจะรองรับหลายสาขา ต้องทำ mapping เพิ่ม (เช่นตาม document_name หรือให้ user เลือก)
    """
    file_bytes = await file.read()
    size_mb = len(file_bytes) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(status_code=413, detail=f"ไฟล์ใหญ่เกิน {MAX_FILE_SIZE_MB}MB")

    try:
        result = ingest_curriculum_pdf(
            db,
            file_bytes=file_bytes,
            document_name=document_name,
            category_id=category_id,
            user_id=user_id,
            sections=CHEMISTRY_2569_SECTIONS,
            description=description,
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="ไม่สามารถ ingest เอกสารหลักสูตรได้ กรุณาตรวจสอบไฟล์") from exc

    return IngestResponse(document_id=result["document_id"], chunks_inserted=result["chunks_inserted"])


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
    รับไฟล์ PDF/Word โดยตรง -> extract text -> chunk -> embed -> insert
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
        raise HTTPException(status_code=400, detail="ไม่พบข้อความในไฟล์ (อาจเป็นไฟล์สแกน/รูปภาพ ที่ต้องใช้ OCR)")

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
        raise HTTPException(status_code=400, detail="ไม่สามารถบันทึกเอกสารได้ กรุณาตรวจสอบข้อมูลที่ส่งมา") from exc

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
        # ไม่ควรโชว์ raw DB error ให้ client เห็นตรงๆ (อาจหลุด schema/credential info)
        raise HTTPException(status_code=400, detail="ไม่สามารถบันทึกเอกสารได้ กรุณาตรวจสอบข้อมูลที่ส่งมา") from exc

    return IngestResponse(**result)


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, db: Session = Depends(get_db)):
    try:
        chunks = retrieve(db, payload.question, k=payload.k)
        answer = generate_answer(db, payload.question, k=payload.k, retrieved=chunks)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="ระบบตอบคำถามขัดข้องชั่วคราว กรุณาลองใหม่") from exc

    sources = list({c.document_name for c in chunks})  # unique document names
    return ChatResponse(answer=answer, sources=sources)