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
import os
import re
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.rag import IngestResponse
from app.schemas.manual_ingest import (
    BuildChunksRequest,
    BuildChunksResponse,
    ChunkPreview,
    ConfirmManualIngestRequest,
    ParseRawResponse,
    RawLineOut,
)
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

BASE_DIR = Path(__file__).resolve().parents[2]
UPLOAD_ROOT = BASE_DIR / "uploads"
PENDING_DIR = UPLOAD_ROOT / "pending"
DOCUMENT_DIR = UPLOAD_ROOT / "documents"
PENDING_DIR.mkdir(parents=True, exist_ok=True)
DOCUMENT_DIR.mkdir(parents=True, exist_ok=True)

# เท่ากับ MAX_FILE_SIZE_MB ใน rag.py (/documents/upload) - endpoint นี้เดิม
# ไม่มีการเช็คขนาดไฟล์เลย ทำให้เสียการป้องกันไปเงียบๆ ถ้า frontend เปลี่ยน
# มาเรียก endpoint นี้แทน (เช่นตอนรวมหน้าอัปโหลด+mark heading เป็นหน้าเดียว)
MAX_FILE_SIZE_MB = 20


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

    size_mb = len(file_bytes) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=413, detail=f"ไฟล์ใหญ่เกิน {MAX_FILE_SIZE_MB}MB"
        )

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

    file_token = uuid.uuid4().hex
    pending_path = PENDING_DIR / f"{file_token}.upload"
    pending_path.write_bytes(file_bytes)

    return ParseRawResponse(
        lines=[
            RawLineOut(
                index=ln.index,
                kind=ln.kind,
                text=ln.text,
                suggested_level=ln.suggested_level,
            )
            for ln in raw_lines
        ],
        file_token=file_token,
    )


@router.get("/{document_id}/download")
def download_document(document_id: int, db: Session = Depends(get_db)):
    from sqlalchemy import text

    row = db.execute(
        text("SELECT file_name, file_path FROM document WHERE document_id = :document_id"),
        {"document_id": document_id},
    ).first()

    if row is None or not row.file_path:
        raise HTTPException(status_code=404, detail="ไม่พบไฟล์เอกสารนี้")

    file_path = (BASE_DIR / row.file_path).resolve()
    if DOCUMENT_DIR.resolve() not in file_path.parents or not file_path.is_file():
        raise HTTPException(status_code=404, detail="ไม่พบไฟล์เอกสารนี้")

    return FileResponse(
        path=file_path,
        filename=row.file_name or file_path.name,
        media_type="application/octet-stream",
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
        if not re.fullmatch(r"[a-f0-9]{32}", body.file_token):
            raise HTTPException(status_code=400, detail="รหัสไฟล์ไม่ถูกต้อง")

        pending_path = PENDING_DIR / f"{body.file_token}.upload"
        if not pending_path.is_file():
            raise HTTPException(
                status_code=400,
                detail="ไม่พบไฟล์ที่อัปโหลดไว้ กรุณาเลือกไฟล์ใหม่แล้วลองอีกครั้ง",
            )

        safe_name = re.sub(r"[^A-Za-z0-9._ก-๙ -]", "_", body.file_name).strip()
        safe_name = safe_name or "document"
        final_name = f"{body.file_token}_{safe_name}"
        final_path = DOCUMENT_DIR / final_name
        shutil.move(str(pending_path), str(final_path))
        file_path = str(final_path.relative_to(BASE_DIR)).replace(os.sep, "/")

        document_id = _insert_document_row(
            db,
            body.document_name,
            body.document_type,
            body.category_id,
            body.user_id,
            body.description,
            body.source_url,
            body.file_name,
            file_path,
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