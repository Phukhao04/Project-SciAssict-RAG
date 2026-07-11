"""
LLM generation service - รวม retrieval + Ollama เป็นคำตอบสุดท้าย
"""
import ollama
from sqlalchemy.orm import Session

from .retrieval import retrieve

SYSTEM_PROMPT = "คุณคือประธานสาขาเทคโนโลยีสารสนเทศและการสื่อสาร มหาวิทยาลัยสงขลานครินทร์"


def generate_answer(db: Session, question: str, model: str = "llama3.2", k: int = 5) -> str:
    """
    retrieve context ที่เกี่ยวข้อง -> ส่งเข้า Ollama -> คืนคำตอบ
    มี error handling กัน Ollama ไม่ตอบ/timeout ทำให้ endpoint crash
    """
    retrieved = retrieve(db, question, k=k)

    if not retrieved:
        return "ขออภัย ไม่พบข้อมูลที่เกี่ยวข้องในระบบสำหรับคำถามนี้"

    context = "\n".join(r.chunk_text for r in retrieved)
    prompt = f"Answer the question based on the following context:\n{context}\n\nQuestion: {question}"

    try:
        response = ollama.chat(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
        )
        return response["message"]["content"]
    except Exception as exc:
        # log ไว้ฝั่ง server, ไม่ควรโชว์ raw error ให้ user เห็นตรงๆ
        print(f"[LLM ERROR] {exc}")
        return "ขออภัย ระบบตอบคำถามขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง"


# ตัวอย่างการเรียกใช้จริงใน FastAPI endpoint
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.utils.llm import generate_answer

router = APIRouter()

@router.post("/chat")
def chat(question: str, db: Session = Depends(get_db)):
    answer = generate_answer(db, question)
    return {"answer": answer}
"""