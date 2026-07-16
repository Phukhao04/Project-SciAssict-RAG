"""
LLM generation service - รวม retrieval + Ollama เป็นคำตอบสุดท้าย
"""
import ollama
from sqlalchemy.orm import Session

from .retrieval import retrieve

# system prompt เข้มงวด บังคับให้ตอบจาก context เท่านั้น ห้ามคาดเดา
# (ปรับจากที่เคยเจอปัญหาตอบผิดจาก context ที่ให้ไว้)
SYSTEM_PROMPT = (
    "คุณคือเจ้าหน้าที่คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์ "
    "หน้าที่ของคุณคือตอบคำถามโดยอ้างอิงจากข้อมูล (context) ที่ให้มาเท่านั้น "
    "กฎที่ต้องทำตามอย่างเคร่งครัด:\n"
    "1. ห้ามคาดเดา ห้ามเติมข้อมูลที่ไม่มีใน context\n"
    "2. ถ้า context ไม่มีคำตอบ ให้ตอบว่า \"ไม่พบข้อมูลนี้ในระบบ\"\n"
    "3. ตอบให้ตรงประเด็น กระชับ ใช้ตัวเลข/ข้อเท็จจริงตามที่ปรากฏใน context เป๊ะๆ"
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

    ถ้ามี `retrieved` ส่งมาแล้ว (จาก endpoint ที่เรียก retrieve() ไปแล้ว)
    จะใช้อันนั้นแทนการ query ซ้ำ (กันเสีย compute ซ้ำซ้อน)
    """
    if retrieved is None:
        retrieved = retrieve(db, question, k=k)

    if not retrieved:
        return "ขออภัย ไม่พบข้อมูลที่เกี่ยวข้องในระบบสำหรับคำถามนี้"

    context = "\n".join(f"[{i+1}] {r.chunk_text}" for i, r in enumerate(retrieved))
    prompt = (
        f"ข้อมูลอ้างอิง (context):\n{context}\n\n"
        f"คำถาม: {question}\n\n"
        "ตอบโดยอ้างอิงจาก context ข้างต้นเท่านั้น ห้ามคาดเดาหรือเติมข้อมูลนอกเหนือจากนี้"
    )

    try:
        response = ollama.chat(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            options={"temperature": 0.1},  # ลด randomness ให้ตอบเกาะ context แน่นขึ้น
        )
        return response["message"]["content"]
    except Exception as exc:
        print(f"[LLM ERROR] {exc}")
        return "ขออภัย ระบบตอบคำถามขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง"