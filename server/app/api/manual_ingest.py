"""
API endpoints สำหรับ manual heading marking flow

ใช้คู่กับ app/utils/ingest_manual.py - แบ่งเป็น 3 ขั้นตอน:
1. POST /parse-raw      - อัปโหลดไฟล์ดิบ -> คืน list บรรทัดให้แอดมิน mark
2. POST /build-chunks   - ส่ง marks กลับมา -> คืน chunk preview (ยังไม่ save)
3. POST /confirm-manual - แอดมินตรวจ chunk แล้ว -> insert + embed จริง

ขั้นตอนที่ 3 reuse _insert_document_row() และ _embed_and_insert_chunks()
จาก app/utils/ingestion.py ตรงๆ (ฟังก์ชันเดียวกับที่ /documents/upload
ใช้อยู่) เพื่อให้ document ที่มาจาก manual-mark กับ document ที่มาจาก
Docling auto-pipeline ถูก insert/embed ด้วยตรรกะเดียวกันเป๊ะ ไม่มี
ทางเบี่ยงที่ทำให้พฤติกรรมสองเส้นทางต่างกัน

วางไฟล์นี้ไว้ที่: server/app/api/manual_ingest.py (โฟลเดอร์เดียวกับ
rag.py ที่ดูแล document endpoints อื่นๆ อยู่แล้ว) แล้ว include_router()
เข้า main.py แบบเดียวกับ router อื่น
"""

import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.rag import IngestResponse
from app.utils.ingest_manual import (
    HeadingMark,
    RawLine,
    build_chunks_from_marks,
    parse_raw_docx,
    parse_raw_pdf,
)
from app.utils.ingestion import _embed_and_insert_chunks, _insert_document_row

# from app.api.deps import require_admin  # เปิดใช้ถ้าอยากบังคับ admin
# เท่านั้น (rag.py endpoint /documents/upload ปัจจุบันก็ไม่ได้บังคับ
# require_admin เหมือนกัน - ตามให้ตรง pattern เดิมของไฟล์นั้นไว้ก่อน)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/rag/documents", tags=["manual-ingest"])


# ---------- Schemas ----------

class RawLineOut(BaseModel):
    index: int
    kind: str
    text: str


class ParseRawResponse(BaseModel):
    lines: list[RawLineOut]


class HeadingMarkIn(BaseModel):
    line_index: int
    level: int


class BuildChunksRequest(BaseModel):
    lines: list[RawLineOut]
    marks: list[HeadingMarkIn]


class ChunkPreview(BaseModel):
    chunk_text: str
    parent_text: str


class BuildChunksResponse(BaseModel):
    chunks: list[ChunkPreview]


class ConfirmManualIngestRequest(BaseModel):
    chunks: list[ChunkPreview]
    document_name: str
    document_type: str
    category_id: int
    user_id: int
    description: str | None = None


# ---------- Endpoints ----------

@router.post("/parse-raw", response_model=ParseRawResponse)
async def parse_raw(
    file: UploadFile = File(...),
):
    """
    รับไฟล์ดิบ (.docx หรือ .pdf) คืน list บรรทัดตามลำดับจริงในเอกสาร
    (ไม่ผ่าน Docling / ไม่สนใจ Word heading style เลย)

    เลือก parser ตามนามสกุลไฟล์ - ทั้งสองฟังก์ชันคืน RawLine list รูปแบบ
    เดียวกัน ทำให้ /build-chunks ทำงานเหมือนกันไม่ว่าไฟล์ต้นทางเป็นอะไร
    """
    filename_lower = (file.filename or "").lower()

    if filename_lower.endswith(".docx"):
        parser = parse_raw_docx
    elif filename_lower.endswith(".pdf"):
        parser = parse_raw_pdf
    else:
        raise HTTPException(
            status_code=400,
            detail="รองรับเฉพาะไฟล์ .docx และ .pdf ในขั้นตอนนี้",
        )

    file_bytes = await file.read()

    try:
        raw_lines = parser(file_bytes)
    except Exception as exc:
        logger.exception("[parse-raw] อ่านไฟล์ไม่สำเร็จ")
        raise HTTPException(
            status_code=400,
            detail=f"อ่านไฟล์ไม่สำเร็จ: {exc}",
        ) from exc

    if not raw_lines:
        raise HTTPException(
            status_code=400,
            detail="ไม่พบเนื้อหาในไฟล์ (ไฟล์อาจว่างเปล่า)",
        )

    return ParseRawResponse(
        lines=[
            RawLineOut(index=ln.index, kind=ln.kind, text=ln.text)
            for ln in raw_lines
        ]
    )


@router.post("/build-chunks", response_model=BuildChunksResponse)
async def build_chunks(body: BuildChunksRequest):
    """
    รับ lines (จาก /parse-raw) + marks (heading ที่แอดมินเลือก)
    คืน chunk preview - ยังไม่ embed หรือ save ลง DB
    """
    if not body.marks:
        raise HTTPException(
            status_code=400,
            detail="ต้อง mark heading อย่างน้อย 1 จุด ก่อนสร้าง chunk",
        )

    raw_lines = [
        RawLine(index=ln.index, kind=ln.kind, text=ln.text)
        for ln in body.lines
    ]
    marks = [
        HeadingMark(line_index=m.line_index, level=m.level)
        for m in body.marks
    ]

    chunks = build_chunks_from_marks(raw_lines, marks)

    if not chunks:
        raise HTTPException(
            status_code=400,
            detail="สร้าง chunk ไม่สำเร็จ (ผลลัพธ์ว่างเปล่า) - เช็ค marks ที่ส่งมา",
        )

    return BuildChunksResponse(
        chunks=[
            ChunkPreview(chunk_text=c["chunk_text"], parent_text=c["parent_text"])
            for c in chunks
        ]
    )


@router.post("/confirm-manual", response_model=IngestResponse)
def confirm_manual_ingest(
    body: ConfirmManualIngestRequest,
    db: Session = Depends(get_db),
):
    """
    บันทึกจริง - แอดมินตรวจ chunk จาก /build-chunks แล้ว (แก้ไขเพิ่มได้
    ก่อนส่งมาที่นี่) เรียก insert + embed ด้วยฟังก์ชันเดียวกับที่
    /documents/upload ใช้ (_insert_document_row, _embed_and_insert_chunks
    ใน ingestion.py) เพื่อให้พฤติกรรมเหมือนกันทุกเส้นทางที่เข้ามา
    """
    if not body.chunks:
        raise HTTPException(
            status_code=400,
            detail="ไม่มี chunk ให้บันทึก",
        )

    try:
        document_id = _insert_document_row(
            db,
            body.document_name,
            body.document_type,
            body.category_id,
            body.user_id,
            body.description,
        )

        chunks = [
            {"chunk_text": c.chunk_text, "parent_text": c.parent_text}
            for c in body.chunks
        ]
        chunks_inserted = _embed_and_insert_chunks(db, document_id, chunks)

    except Exception as exc:
        db.rollback()
        logger.exception("[confirm-manual] บันทึกเอกสารไม่สำเร็จ")
        raise HTTPException(
            status_code=400,
            detail="ไม่สามารถบันทึกเอกสารได้ กรุณาตรวจสอบข้อมูลที่ส่งมา",
        ) from exc

    return IngestResponse(document_id=document_id, chunks_inserted=chunks_inserted)