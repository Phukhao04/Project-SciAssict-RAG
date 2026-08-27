import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)
from fastapi import FastAPI
from app.api.auth import router as auth_router
from app.api.rag import router as rag_router
from fastapi.middleware.cors import CORSMiddleware
from app.api.chat import router as chat_router
from app.api.admin import router as admin_router
from app.api.user import router as user_router
from app.api import manual_ingest

app = FastAPI(title="SciAssist RAG API")
app.include_router(auth_router)
app.include_router(rag_router)
app.include_router(chat_router)
app.include_router(admin_router)
app.include_router(user_router)
app.include_router(manual_ingest.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # port ของ Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.get("/health")
def health_check():
    return {"status": "connected"}