import json
import logging

import httpx
from sqlalchemy.orm import Session

from .retrieval import retrieve
from app.prompts.rag_system_prompt import SYSTEM_PROMPT, PROMPT_VERSION
from app.config import settings

logger = logging.getLogger(__name__)

DOTBLUE_CHAT_URL = "https://ai.psu.blue/v1/chat/completions"


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
        _build_context_block(i, chunk)
        for i, chunk in enumerate(retrieved, start=1)
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


def _parse_sse_stream(body: str) -> str:
    """dotBlue ส่งกลับมาเป็น Server-Sent Events
    (บรรทัด 'data: {...}' หลายก้อนต่อกัน)
    แทน JSON ก้อนเดียว แม้จะขอ stream=false ก็ตาม
    """
    full_text = ""

    for line in body.splitlines():
        line = line.strip()

        if not line.startswith("data:"):
            continue

        payload = line[len("data:"):].strip()

        if payload == "[DONE]" or not payload:
            continue

        try:
            event = json.loads(payload)
        except json.JSONDecodeError:
            continue

        choices = event.get("choices") or []

        if not choices:
            continue

        delta = choices[0].get("delta") or {}
        full_text += delta.get("content") or ""

    return full_text


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

    prompt = _build_prompt(question, retrieved)

    logger.debug(
        "[llm] prompt (%s):\n%s",
        PROMPT_VERSION,
        prompt,
    )

    try:
        http_response = httpx.post(
            DOTBLUE_CHAT_URL,
            headers={
                "Authorization": f"Bearer {settings.dotblue_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "max_tokens": 1024,
                "stream": False,
                "messages": [
                    {
                        "role": "system",
                        "content": SYSTEM_PROMPT,
                    },
                    {
                        "role": "user",
                        "content": prompt,
                    },
                ],
            },
            timeout=60,
            follow_redirects=True,
        )
    except Exception:
        logger.exception("[llm] เรียก LLM ไม่สำเร็จ (request)")
        return "ขออภัย ระบบตอบคำถามขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง"

    if http_response.status_code >= 400:
        logger.error(
            "[llm] dotBlue ตอบ error status=%s body=%s",
            http_response.status_code,
            http_response.text[:500],
        )
        return "ขออภัย ระบบตอบคำถามขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง"

    body_text = http_response.text

    # ตอบแบบ JSON ก้อนเดียว
    try:
        data = json.loads(body_text)
        return data["choices"][0]["message"]["content"].strip()
    except (json.JSONDecodeError, KeyError, IndexError, TypeError):
        pass

    # ตอบแบบ SSE stream
    if "data:" in body_text:
        answer = _parse_sse_stream(body_text).strip()

        if answer:
            return answer

    logger.error(
        "[llm] parse response ไม่สำเร็จในทั้งสองรูปแบบ body=%s",
        body_text[:500],
    )

    return "ขออภัย ระบบตอบคำถามขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง"