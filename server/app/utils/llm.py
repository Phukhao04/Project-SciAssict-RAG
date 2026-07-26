"""
LLM Generation Service

หน้าที่
1. รับ Context จาก Retrieval
2. สร้าง Prompt
3. ส่งเข้า Ollama
4. คืนคำตอบ

v1.1: ปรับ prompt ให้ใช้ XML tags คั่น context/question แทน "=========="
      และตัด similarity distance ออกจาก context ที่ส่งเข้า LLM
      (distance เป็นเลขที่มีประโยชน์แค่ตอน debug ฝั่งเรา ไม่มีประโยชน์กับ LLM
      เพราะมันไม่รู้ว่า 0.32 ถือว่าดีหรือแย่ มีแต่จะกินโทเค็นเปล่า ๆ)
"""

import ollama
from sqlalchemy.orm import Session

from .retrieval import retrieve
from app.prompts.rag_system_prompt import SYSTEM_PROMPT, PROMPT_VERSION


def _build_context_block(index: int, chunk) -> str:
    """
    สร้าง <context> block เดียว จาก 1 chunk ที่ retrieve มาได้
    ใช้ XML tag แทนตัวคั่นแบบ "==========" เพื่อให้โมเดลแยกขอบเขต
    ของแต่ละ context ได้ชัดเจนกว่า (โมเดลรู้ attribute source ได้ในตัว
    โดยไม่ต้องเดาจากข้อความ)

    หมายเหตุ: ตั้งใจไม่ใส่ distance ที่นี่ เพราะเป็นเลขที่ไม่มีความหมาย
    สำหรับ LLM ให้ใช้แค่ตอน debug/print ใน retrieval.py แทน
    """
    return (
        f'<context index="{index}" source="{chunk.document_name}">\n'
        f"{chunk.chunk_text}\n"
        f"</context>"
    )


def _build_prompt(question: str, retrieved: list) -> str:
    """
    ประกอบ context blocks + คำถาม เข้าเป็น prompt เดียว
    แยกฟังก์ชันออกมาจาก generate_answer เพื่อให้ทดสอบ/ปรับ format
    ได้อิสระโดยไม่กระทบ logic การเรียก ollama
    """
    context = "\n\n".join(
        _build_context_block(i, chunk) for i, chunk in enumerate(retrieved, start=1)
    )

    return f"""<context_documents>
{context}
</context_documents>

<question>
{question}
</question>

Answer the question using only the information inside <context_documents>.
If the answer is not there, respond exactly: "ไม่พบข้อมูลนี้ในระบบ"
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
    # Build Prompt
    # -------------------------

    prompt = _build_prompt(question, retrieved)

    # -------------------------
    # Debug
    # -------------------------

    print(f"\n================ PROMPT ({PROMPT_VERSION}) ================\n")
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