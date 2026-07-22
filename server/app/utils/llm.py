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

    # -------------------------
    # Retrieval
    # -------------------------

    if retrieved is None:
        retrieved = retrieve(
            db,
            question,
            k=k,
        )

    if not retrieved:
        return "ไม่พบข้อมูลนี้ในระบบ"

    # -------------------------
    # Build Context
    # -------------------------

    context_parts = []

    for i, chunk in enumerate(retrieved, start=1):

        context_parts.append(
            f"""
========== Context {i} ==========

เอกสาร :
{chunk.document_name}

เนื้อหา :
{chunk.chunk_text}

Similarity Distance :
{chunk.distance:.4f}
"""
        )

    context = "\n".join(context_parts)

    # -------------------------
    # Prompt
    # -------------------------

    prompt = f"""
Context

{context}

--------------------------------

Question

{question}

--------------------------------

Instructions

- ใช้เฉพาะข้อมูลใน Context

- ถ้าหาไม่พบ
ตอบว่า
"ไม่พบข้อมูลนี้ในระบบ"

- ห้ามเดา

--------------------------------

Answer
"""

    # -------------------------
    # Debug
    # -------------------------

    print("\n================ PROMPT ================\n")
    print(prompt)
    print("\n========================================\n")

    # -------------------------
    # Generate
    # -------------------------

    try:

        response = ollama.chat(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": SYSTEM_PROMPT,
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            options={
                "temperature": 0,
                "top_p": 0.9,
                "num_predict": 512,
            },
        )

        answer = response["message"]["content"].strip()

        return answer

    except Exception as exc:

        print(f"[LLM ERROR] {exc}")

        return "ขออภัย ระบบตอบคำถามขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง"