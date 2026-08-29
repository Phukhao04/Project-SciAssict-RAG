import os
from anthropic import Anthropic
from sqlalchemy.orm import Session

from .retrieval import retrieve
from app.prompts.rag_system_prompt import SYSTEM_PROMPT, PROMPT_VERSION
from app.config import settings

client = Anthropic(
    base_url="https://ai.psu.blue/anthropic",
    api_key=settings.dotblue_api_key,
)

def _format_heading_match_answer(chunks: list) -> str:
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
    model: str = "PSU-LLM/psu-gemma",
    k: int = 3,
    retrieved=None,
) -> str:
    if retrieved is None:
        retrieved = retrieve(db, question, k=k)

    if not retrieved:
        return "ไม่พบข้อมูลนี้ในระบบ"

    # --- ปิดชั่วคราวเพื่อทดสอบ psu-gemma แบบไม่มี template ช่วย ---
    # if all(getattr(c, "match_type", "vector") == "heading" for c in retrieved):
    #     return _format_heading_match_answer(retrieved)

    prompt = _build_prompt(question, retrieved)

    print(f"\n================ PROMPT ({PROMPT_VERSION}) ================\n")
    print(prompt)
    print("\n========================================\n")

    try:
        response = client.messages.create(
            model=model,
            system=SYSTEM_PROMPT,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text.strip()

    except Exception as exc:
        print(f"[LLM ERROR] {exc}")
        return "ขออภัย ระบบตอบคำถามขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง"