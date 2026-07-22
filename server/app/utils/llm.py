"""
LLM Generation Service

หน้าที่
1. รับ Context จาก Retrieval
2. สร้าง Prompt
3. ส่งเข้า Ollama
4. คืนคำตอบ
"""

import ollama
from sqlalchemy.orm import Session

from .retrieval import retrieve

SYSTEM_PROMPT = """
คุณคือผู้ช่วยตอบคำถามของคณะวิทยาศาสตร์
มหาวิทยาลัยสงขลานครินทร์

หน้าที่ของคุณคือใช้เฉพาะข้อมูลใน Context เท่านั้น

กฎที่ต้องปฏิบัติ

1. ห้ามใช้ความรู้ภายนอก

2. ห้ามคาดเดา

3. ถ้า Context ไม่มีคำตอบ
ตอบว่า

"ไม่พบข้อมูลนี้ในระบบ"

4. ถ้ามีหลาย Context
ให้นำข้อมูลมาสรุปรวม

5. ถ้ามีข้อมูลขัดแย้งกัน
ให้แจ้งว่าพบข้อมูลไม่ตรงกัน

6. ถ้าคำถามต้องการตัวเลข
ให้ใช้ตัวเลขตาม Context เท่านั้น

7. ตอบเป็นภาษาไทยที่สุภาพ กระชับ และเข้าใจง่าย

8. ไม่ต้องบอกว่า "จากข้อมูลที่ได้รับ"
ตอบคำถามได้เลย
"""


def generate_answer(
    db: Session,
    question: str,
    model: str = "llama3.2",
    k: int = 3,
    retrieved=None,
) -> str:

    if retrieved is None:
        retrieved = retrieve(db, question, k=k)

    if not retrieved:
        return "ไม่พบข้อมูลนี้ในระบบ"

    # เปลี่ยนจาก "Context 1/2/3" เป็นแค่บรรทัดคั่นเอกสารเฉยๆ
    # กัน LLM หยิบคำว่า "Context" ไปพูดในคำตอบ (ตามกฎข้อ 8 ที่ห้ามบอกที่มา)
    context_parts = []
    for chunk in retrieved:
        context_parts.append(f"[{chunk.document_name}] {chunk.chunk_text}")

    context = "\n\n".join(context_parts)

    prompt = f"""
ข้อมูลอ้างอิง:

{context}

--------------------------------

คำถาม: {question}

--------------------------------

ตอบคำถามจากข้อมูลอ้างอิงข้างต้นเท่านั้น ห้ามพูดถึงคำว่า "ข้อมูลอ้างอิง" หรือบอกที่มาของข้อมูลในคำตอบ
ถ้าไม่พบคำตอบ ให้ตอบว่า "ไม่พบข้อมูลนี้ในระบบ" ห้ามเดา
"""

    print("\n================ PROMPT ================\n")
    print(prompt)
    print("\n========================================\n")

    try:
        response = ollama.chat(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            options={"temperature": 0, "top_p": 0.9, "num_predict": 512},
        )
        return response["message"]["content"].strip()
    except Exception as exc:
        print(f"[LLM ERROR] {exc}")
        return "ขออภัย ระบบตอบคำถามขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง"