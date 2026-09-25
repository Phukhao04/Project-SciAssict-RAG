from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.rag import (
    ChatRequest,
    ChatResponse,
    IngestResponse,
    CategoryResponse,
    CategoryCreateRequest,
    DocumentListItem,
    DocumentDetailResponse,
    StatsResponse,
    QueryActivityItem,
)
from app.utils.llm import generate_answer
from app.utils.retrieval import retrieve
from app.crud.chat_crud import create_session, save_message
from app.crud.document_crud import (
    get_all_categories,
    create_category,
    delete_document,
    get_all_documents,
    get_document_detail,
    get_stats,
    get_query_activity,
)

router = APIRouter(prefix="/api/rag", tags=["RAG"])


@router.get("/categories", response_model=list[CategoryResponse])
def list_categories(db: Session = Depends(get_db)):
    """ให้ frontend ดึงไปแสดงใน dropdown ตอนอัปโหลดเอกสาร"""
    return get_all_categories(db)


@router.post("/categories", response_model=CategoryResponse, status_code=201)
def add_category(
    payload: CategoryCreateRequest,
    db: Session = Depends(get_db),
):
    try:
        return create_category(db, payload.category_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/documents/{document_id}", response_model=DocumentDetailResponse)
def get_document(document_id: int, db: Session = Depends(get_db)):
    result = get_document_detail(db, document_id)
    if result is None:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสารนี้ในระบบ")
    return result


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