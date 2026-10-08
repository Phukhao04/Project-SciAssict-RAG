from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.crud.chat_crud import create_session, get_session_owner, save_message
from app.crud.document_crud import (
    create_category,
    create_program,
    delete_document,
    get_all_categories,
    get_all_documents,
    get_all_programs,
    get_document_detail,
    get_query_activity,
    get_stats,
    update_chunk_content,
)
from app.db.session import get_db
from app.schemas.rag import (
    CategoryCreateRequest,
    CategoryResponse,
    ChatRequest,
    ChatResponse,
    ChatSource,
    DocumentDetailResponse,
    DocumentListItem,
    ProgramCreateRequest,
    ProgramResponse,
    QueryActivityItem,
    StatsResponse,
    UpdateChunkRequest,
)
from app.utils.llm import generate_answer
from app.utils.retrieval import retrieve

router = APIRouter(prefix="/api/rag", tags=["RAG"])


@router.get("/categories", response_model=list[CategoryResponse])
def list_categories(db: Session = Depends(get_db)):
    return get_all_categories(db)


@router.post(
    "/categories",
    response_model=CategoryResponse,
    status_code=201,
    dependencies=[Depends(require_admin)],
)
def add_category(
    payload: CategoryCreateRequest,
    db: Session = Depends(get_db),
):
    try:
        return create_category(db, payload.category_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/programs", response_model=list[ProgramResponse])
def list_programs(db: Session = Depends(get_db)):
    return get_all_programs(db)


@router.post(
    "/programs",
    response_model=ProgramResponse,
    status_code=201,
    dependencies=[Depends(require_admin)],
)
def add_program(
    payload: ProgramCreateRequest,
    db: Session = Depends(get_db),
):
    try:
        return create_program(db, payload.program_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/documents/{document_id}", response_model=DocumentDetailResponse)
def get_document(document_id: int, db: Session = Depends(get_db)):
    result = get_document_detail(db, document_id)
    if result is None:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสารนี้ในระบบ")
    return result


@router.put(
    "/documents/{document_id}/chunks/{chunk_id}",
    dependencies=[Depends(require_admin)],
)
def edit_chunk(
    document_id: int,
    chunk_id: int,
    payload: UpdateChunkRequest,
    db: Session = Depends(get_db),
):
    """Update chunk text and regenerate its embedding."""
    result = update_chunk_content(db, document_id, chunk_id, payload.chunk_text)
    if result is None:
        raise HTTPException(status_code=404, detail="ไม่พบ chunk นี้ในระบบ")
    return result


def _char_ngrams(s: str, n: int = 4) -> set[str]:
    s = "".join((s or "").split())
    return {s[i : i + n] for i in range(len(s) - n + 1)}


def _pick_source_chunk(answer: str, chunks: list):
    """เลือก chunk ที่มีเนื้อหาตรงกับคำตอบมากที่สุด"""
    if not chunks:
        return None

    fallback = min(
        (c for c in chunks if c.match_type == "vector"),
        key=lambda c: c.distance,
        default=chunks[0],
    )

    answer_grams = _char_ngrams(answer)
    if not answer_grams:
        return fallback

    best = max(
        chunks,
        key=lambda c: (len(answer_grams & _char_ngrams(c.parent_text)), -c.distance),
    )
    if not answer_grams & _char_ngrams(best.parent_text):
        return fallback
    return best


@router.post("/chat", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user["user_id"]

    session_id = payload.session_id
    if session_id is None:
        session_id = create_session(db, user_id, payload.question)
    else:
        owner_id = get_session_owner(db, session_id)
        if owner_id is None:
            raise HTTPException(status_code=404, detail="ไม่พบบทสนทนานี้")
        if owner_id != user_id:
            raise HTTPException(status_code=403, detail="คุณไม่มีสิทธิ์เข้าถึงบทสนทนานี้")

    try:
        chunks = retrieve(db, payload.question, k=payload.k)
        answer = generate_answer(db, payload.question, k=payload.k, retrieved=chunks)
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail="ระบบตอบคำถามขัดข้องชั่วคราว กรุณาลองใหม่"
        ) from exc

    save_message(db, session_id, user_id, "user", payload.question)

    best_chunk = _pick_source_chunk(answer, chunks)

    sources = []
    if best_chunk is not None and answer.strip() != "ไม่พบข้อมูลนี้ในระบบ":
        sources = [
            ChatSource(
                document_id=best_chunk.document_id,
                file_name=best_chunk.file_name or best_chunk.document_name,
                source_url=best_chunk.source_url,
                download_url=f"/api/rag/documents/{best_chunk.document_id}/download",
            )
        ]

    source_payload = [source.model_dump() for source in sources]

    save_message(
        db,
        session_id,
        user_id,
        "bot",
        answer,
        sources=source_payload,
    )

    return ChatResponse(answer=answer, sources=sources, session_id=session_id)


@router.get("/documents", response_model=list[DocumentListItem])
def list_documents(db: Session = Depends(get_db)):
    return get_all_documents(db)


@router.delete(
    "/documents/{document_id}",
    dependencies=[Depends(require_admin)],
)
def remove_document(
    document_id: int,
    db: Session = Depends(get_db),
):
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