"""
RAG API endpoints
ทำไมไฟล์นี้ "บาง" (ไม่มี logic เยอะ): เพราะ logic จริงอยู่ใน utils/ หมดแล้ว
ไฟล์นี้มีหน้าที่แค่ "รับ request -> เรียก utils -> ส่ง response" เท่านั้น
"""

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.rag import (
    ChatRequest,
    ChatResponse,
    IngestRequest,
    IngestResponse,
    CategoryResponse,
    DocumentListItem,
    DocumentDetailResponse,
    StatsResponse,
    QueryActivityItem,
)
from app.utils.extraction import UnsupportedFileTypeError, extract_text
from app.utils.ingestion import ingest_document
from app.utils.llm import generate_answer
from app.utils.retrieval import retrieve
from app.crud.chat_crud import create_session, save_message
from app.crud.document_crud import (
    get_all_categories,
    delete_document,
    get_all_documents,
    get_document_detail,
    get_stats,
    get_query_activity,
)

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
    รับไฟล์ PDF/Word โดยตรง -> extract (ได้ list ของ (heading_level, text))
    -> chunk_by_headings (v2: ใช้ Heading Style จริงจาก Word แทน regex เดา) -> embed -> insert

    หมายเหตุ: extract_text() คืนค่าเป็น list[(heading_level, text)] เสมอ
    ไฟล์ .docx จะมี heading_level จาก Heading Style ที่ผู้ใช้เลือกไว้ใน Word จริงๆ
    ส่วนไฟล์ .pdf จะได้ heading_level=None ทุกบรรทัด (PDF ไม่มี style ให้อ่าน)
    """
    file_bytes = await file.read()
    size_mb = len(file_bytes) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=413, detail=f"ไฟล์ใหญ่เกิน {MAX_FILE_SIZE_MB}MB"
        )

    try:
        paragraphs = extract_text(file.filename, file_bytes)
    except UnsupportedFileTypeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # เช็คว่ามีข้อความจริงอยู่บ้างไหม (กันไฟล์สแกน/รูปภาพที่ extract แล้วว่างเปล่า)
    has_text = any(t.strip() for _, t in paragraphs)
    if not has_text:
        raise HTTPException(
            status_code=400,
            detail="ไม่พบข้อความในไฟล์ (อาจเป็นไฟล์สแกน/รูปภาพ ที่ต้องใช้ OCR)",
        )

    document_type = file.filename.lower().rsplit(".", 1)[-1]

    try:
        result = ingest_document(
            db,
            paragraphs=paragraphs,
            document_name=document_name,
            document_type=document_type,
            category_id=category_id,
            user_id=user_id,
            description=description,
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="ไม่สามารถบันทึกเอกสารได้ กรุณาตรวจสอบข้อมูลที่ส่งมา",
        ) from exc

    return IngestResponse(**result)


@router.get("/categories", response_model=list[CategoryResponse])
def list_categories(db: Session = Depends(get_db)):
    """ให้ frontend ดึงไปแสดงใน dropdown ตอนอัปโหลดเอกสาร"""
    return get_all_categories(db)


@router.get("/documents/{document_id}", response_model=DocumentDetailResponse)
def get_document(document_id: int, db: Session = Depends(get_db)):
    result = get_document_detail(db, document_id)
    if result is None:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสารนี้ในระบบ")
    return result


@router.post("/documents/ingest", response_model=IngestResponse)
def ingest(payload: IngestRequest, db: Session = Depends(get_db)):
    """
    รับ text ดิบๆ ตรงๆ (ไม่ใช่ไฟล์) -> ไม่มี heading style ให้อ่าน
    เลยแปลงเป็น list[(None, บรรทัด)] ทุกบรรทัด แล้วส่งเข้า ingest_document
    ตัวเดียวกับ endpoint upload เพื่อให้ทั้งระบบ chunk ด้วยตรรกะเดียวกันเสมอ
    """
    paragraphs = [
        (None, line) for line in payload.text.split("\n") if line.strip()
    ]

    try:
        result = ingest_document(
            db,
            paragraphs=paragraphs,
            document_name=payload.document_name,
            document_type=payload.document_type,
            category_id=payload.category_id,
            user_id=payload.user_id,
            description=payload.description,
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="ไม่สามารถบันทึกเอกสารได้ กรุณาตรวจสอบข้อมูลที่ส่งมา",
        ) from exc

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
        raise HTTPException(
            status_code=500, detail="ระบบตอบคำถามขัดข้องชั่วคราว กรุณาลองใหม่"
        ) from exc

    # บันทึกทั้งคำถามและคำตอบลง messages อัตโนมัติ
    save_message(db, session_id, payload.user_id, "user", payload.question)
    save_message(db, session_id, payload.user_id, "bot", answer)

    sources = list({c.document_name for c in chunks})
    return ChatResponse(answer=answer, sources=sources, session_id=session_id)


@router.get("/documents", response_model=list[DocumentListItem])
def list_documents(db: Session = Depends(get_db)):
    return get_all_documents(db)


@router.delete("/documents/{document_id}")
def remove_document(document_id: int, db: Session = Depends(get_db)):
    deleted = delete_document(db, document_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสารนี้ในระบบ")
    return {"success": True, "document_id": document_id}

@router.get("/stats", response_model=StatsResponse)
def stats(db: Session = Depends(get_db)):
    return get_stats(db)


@router.get("/query-activity", response_model=list[QueryActivityItem])
def query_activity(weeks: int = 13, db: Session = Depends(get_db)):
    return get_query_activity(db, weeks=weeks)