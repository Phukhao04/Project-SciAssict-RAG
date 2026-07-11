from fastapi import FastAPI
from sqlalchemy import text
from app.db.session import engine

app = FastAPI(title="SciAssist RAG API")

@app.get("/health/db")
def check_db():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "connected"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}