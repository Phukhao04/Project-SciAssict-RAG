# SciAssist RAG — Backend

FastAPI + TiDB (vector search) + bge-m3 embedding + Anthropic-compatible LLM (ai.psu.blue)

## เริ่มใช้งาน

```bash
cd server
python -m venv venv
venv\Scripts\activate           # Windows (PowerShell: venv\Scripts\Activate.ps1)
pip install -r requirements.txt

cp .env.example .env             # แล้วเติมค่าจริง
uvicorn main:app --reload        # http://127.0.0.1:8000  (docs ที่ /docs)
```

Frontend (Vite) รันที่ `http://localhost:5173` และ CORS ใน `main.py` อนุญาต origin นั้นไว้แล้ว

## โครงสร้าง

```
main.py                 จุดเริ่ม FastAPI + include routers + CORS
app/
├── api/                route layer — รับ request, เรียก crud/utils, ส่ง response
│   ├── deps.py         get_current_user / require_admin (อ่าน JWT จาก header)
│   ├── auth.py         /api/authen/*      สมัคร + challenge-response login
│   ├── user.py         /api/user/me       โปรไฟล์ตัวเอง (user_id จาก JWT)
│   ├── chat.py         /api/chat/*        ประวัติ session/messages
│   ├── admin.py        /api/admin/*       จัดการผู้ใช้ (require_admin)
│   ├── rag.py          /api/rag/*         chat, เอกสาร, สถิติ
│   └── manual_ingest.py /api/rag/documents/{parse-raw,build-chunks,confirm-manual}
├── crud/               DB access layer (raw SQL ผ่าน SQLAlchemy text())
├── schemas/            Pydantic request/response models
├── models/             SQLAlchemy ORM models — สะท้อน schema ของ DB
├── db/session.py       engine + SessionLocal + get_db()
├── prompts/            system prompt ของ RAG (versioned)
└── utils/              logic จริง: embedding, retrieval, llm, ingestion, chunking
```

## เส้นทางเพิ่มเอกสาร (ingestion)

| เส้นทาง | endpoint | ที่มา heading |
|---|---|---|
| Manual mark (ใช้จริงจาก UI) | `parse-raw` → `build-chunks` → `confirm-manual` | แอดมิน mark เองผ่าน UI |
| Auto (Docling) | `POST /api/rag/documents/upload` | เดาจาก Word heading style |
| Raw text | `POST /api/rag/documents/ingest` | ไม่มี — 1 บรรทัด = 1 chunk |

ทั้ง 3 เส้นทางลง insert/embed ด้วย `insert_document_row()` + `embed_and_insert_chunks()`
ใน `utils/ingestion.py` ชุดเดียวกัน

## หมายเหตุ

- ไม่มี migration tool — schema ของ DB จัดการนอก repo นี้ `app/models/` เป็นเอกสารอ้างอิง schema (ยังไม่ถูกใช้ query จริง โค้ดใช้ raw SQL)
- ยังไม่มีชุดทดสอบ
