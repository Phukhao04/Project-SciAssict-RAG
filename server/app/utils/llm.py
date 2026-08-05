"""
LLM Generation Service

v2: ตัดการ reformat ROW_MARKER ออก (ไม่จำเป็นอีกต่อไป) เพราะ parent_text
ที่ได้จาก Docling (ผ่าน contextualize()) เป็นข้อความที่มี heading context
นำหน้าและอ่านง่ายอยู่แล้วตั้งแต่ต้นทาง ไม่ต้องมาแปลงซ้ำตอนสร้าง prompt
"""

import ollama
from sqlalchemy.orm import Session

from .retrieval import retrieve
from app.prompts.rag_system_prompt import SYSTEM_PROMPT, PROMPT_VERSION


def _format_heading_match_answer(chunks: list) -> str:
    """
    จัดรูปแบบคำตอบตรงๆ จาก parent_text โดยไม่ผ่าน LLM เลย

    เหตุผล: ทดสอบแล้วหลายรอบว่า llama3.2 (โมเดลเล็กที่รันบน Ollama)
    ไม่น่าเชื่อถือพอที่จะแจกแจง list รายวิชายาวๆ ให้ครบทุกตัวพร้อม
    รายละเอียด (รหัส/ชื่อ/หน่วยกิต) แม้จะสั่งเน้นย้ำในระบบ prompt แล้วก็
    ตาม (ตัดวิชา/รหัส/หน่วยกิตทิ้งไปเองซ้ำๆ ทั้งที่ context ที่ได้รับถูก
    100%) วิธีที่แน่นอนกว่าคือไม่ต้องพึ่งการ "เรียบเรียงคำตอบ" ของ LLM
    เลยสำหรับกรณีนี้ - format ข้อมูลที่ retrieve มาได้ตรงๆ แทน

    ใช้เฉพาะกรณี heading-match สำเร็จ (คำถามระบุปี/เทอมชัดเจน - ดู
    retrieval.py) เพราะมั่นใจได้ว่าข้อมูลถูกต้อง 100% อยู่แล้ว ไม่ใช่แค่
    "น่าจะเกี่ยวข้อง" แบบผลจาก vector search

    v1.1: เติมประโยคขึ้นต้นแบบ template (ไม่ใช่ LLM สร้าง) ให้คำตอบดูเป็น
    แชทมากขึ้น แทนที่จะเป็น list ดิบๆ ล้วน - ยังคง deterministic 100%
    เพราะ template มาจาก heading ที่มีอยู่แล้วตรงๆ ไม่ได้ให้โมเดลแต่งเอง
    """
    sections = []
    for chunk in chunks:
        lines = chunk.parent_text.strip().split("\n")
        heading = lines[0].replace(" > ", " ")
        body_lines = [f"- {line}" for line in lines[1:] if line.strip()]
        intro = f"รายวิชาสำหรับ{heading} มีดังนี้ครับ:"
        sections.append(intro + "\n" + "\n".join(body_lines))
    return "\n\n".join(sections)


def _build_context_block(index: int, chunk) -> str:
    """สร้าง <context> block เดียว จาก 1 chunk ที่ retrieve มาได้ ใช้ parent_text"""
    return (
        f'<context index="{index}" source="{chunk.document_name}">\n'
        f"{chunk.parent_text}\n"
        f"</context>"
    )


def _build_prompt(question: str, retrieved: list) -> str:
    """ประกอบ context blocks + คำถาม เข้าเป็น prompt เดียว"""
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
    if retrieved is None:
        retrieved = retrieve(db, question, k=k)

    if not retrieved:
        return "ไม่พบข้อมูลนี้ในระบบ"

    # ถ้า chunk ทั้งหมดมาจาก heading-match (คำถามระบุปี/เทอมชัดเจน)
    # ข้อมูลถูกต้อง 100% อยู่แล้ว - format ตรงๆ ไม่ต้องเสี่ยงให้ LLM
    # เรียบเรียงแล้วตัดรายละเอียดทิ้ง (ดู _format_heading_match_answer)
    if all(getattr(c, "match_type", "vector") == "heading" for c in retrieved):
        return _format_heading_match_answer(retrieved)

    prompt = _build_prompt(question, retrieved)

    print(f"\n================ PROMPT ({PROMPT_VERSION}) ================\n")
    print(prompt)
    print("\n========================================\n")

    try:
        response = ollama.chat(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            options={
                "temperature": 0,
                "top_p": 0.9,
                "num_predict": 1024,  # เพิ่มจาก 512 - เผื่อคำตอบยาวขึ้นตอน context สมบูรณ์กว่าเดิม
                "num_ctx": 4096,  # เพิ่มเข้ามาใหม่ - เดิมไม่เคยตั้งเลย อาจทำให้ context
                                   # window เล็กเกินไปจน generation โดนตัดก่อนจบ
                                   # (ยิ่งค่าสูง ยิ่งกิน RAM/VRAM มากขึ้น 4096 เป็นค่าที่
                                   # ปลอดภัยสำหรับ llama3.2 บนเครื่องทั่วไป)
            },
        )
        return response["message"]["content"].strip()

    except Exception as exc:
        print(f"[LLM ERROR] {exc}")
        return "ขออภัย ระบบตอบคำถามขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง"