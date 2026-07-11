"""
LLM generation service - รวม retrieval + Ollama เป็นคำตอบสุดท้าย
"""
import ollama
from sqlalchemy.orm import Session

from .retrieval import retrieve

SYSTEM_PROMPT = (
    "คุณคือประธานสาขาเทคโนโลยีสารสนเทศและการสื่อสาร มหาวิทยาลัยสงขลานครินทร์ "
    "หน้าที่ของคุณคือตอบคำถามโดยอ้างอิงจากข้อมูล (context) ที่ให้มาเท่านั้น "
    "กฎที่ต้องทำตามอย่างเคร่งครัด:\n"
    "1. ห้ามคาดเดา ห้ามเติมข้อมูลที่ไม่มีใน context\n"
    "2. ถ้า context ไม่มีคำตอบ ให้ตอบว่า \"ไม่พบข้อมูลนี้ในระบบ\" ห้ามแต่งคำตอบขึ้นเอง\n"
    "3. ตอบให้ตรงประเด็น กระชับ ใช้ตัวเลข/ข้อเท็จจริงตามที่ปรากฏใน context เป๊ะๆ ห้ามปัดเศษหรือประมาณค่า\n"
    "4. ห้ามใช้คำที่แสดงความไม่แน่นอนเช่น \"น่าจะ\", \"อาจจะ\", \"ประมาณ\" หากใน context ระบุค่าที่แน่นอนอยู่แล้ว"
)


def generate_answer(
    db: Session,
    question: str,
    model: str = "llama3.2",
    k: int = 5,
    retrieved: list | None = None,
) -> str:
    """
    retrieve context ที่เกี่ยวข้อง -> ส่งเข้า Ollama -> คืนคำตอบ
    มี error handling กัน Ollama ไม่ตอบ/timeout ทำให้ endpoint crash

    ถ้ามี `retrieved` ส่งมาแล้ว (เช่นจาก endpoint ที่เรียก retrieve() ไปแล้ว)
    จะใช้อันนั้นแทนการ query ซ้ำ
    """
    if retrieved is None:
        retrieved = retrieve(db, question, k=k)

    if not retrieved:
        return "ขออภัย ไม่พบข้อมูลที่เกี่ยวข้องในระบบสำหรับคำถามนี้"

    # ใส่เลขกำกับแต่ละ context ให้ตัด noise จาก chunk ซ้ำซ้อนได้ง่ายขึ้น
    context = "\n".join(f"[{i+1}] {r.chunk_text}" for i, r in enumerate(retrieved))
    prompt = (
        f"ข้อมูลอ้างอิง (context):\n{context}\n\n"
        f"คำถาม: {question}\n\n"
        "ตอบโดยอ้างอิงจาก context ข้างต้นเท่านั้น ห้ามคาดเดาหรือเติมข้อมูลนอกเหนือจากนี้ "
        "ตอบสั้น กระชับ ตรงประเด็น"
    )

    try:
        response = ollama.chat(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            options={"temperature": 0.1},  # ลด randomness กันตอบเพี้ยนจาก context
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