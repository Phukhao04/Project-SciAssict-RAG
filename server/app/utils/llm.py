import json
import logging

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.prompts.rag_system_prompt import PROMPT_VERSION, SYSTEM_PROMPT

from .retrieval import retrieve

logger = logging.getLogger(__name__)

DOTBLUE_CHAT_URL = "https://ai.psu.blue/v1/chat/completions"

# Limit each history message to keep the prompt concise.
HISTORY_CHAR_LIMIT = 400


def _build_context_block(index: int, chunk) -> str:
    """Format one retrieved chunk as a context block."""
    return (
        f'<context index="{index}" source="{chunk.document_name}">\n'
        f"{chunk.parent_text}\n"
        f"</context>"
    )


def _format_history(history: list[dict]) -> str:
    lines = []
    for m in history:
        who = "ผู้ใช้" if m["role"] == "user" else "ผู้ช่วย"
        body = (m["text"] or "").strip()
        if len(body) > HISTORY_CHAR_LIMIT:
            body = body[:HISTORY_CHAR_LIMIT] + "..."
        lines.append(f"{who}: {body}")
    return "\n".join(lines)


def _build_prompt(
    question: str,
    retrieved: list,
    history: list[dict] | None = None,
) -> str:
    """Combine retrieved context, conversation history, and question."""
    context = "\n\n".join(
        _build_context_block(i, chunk)
        for i, chunk in enumerate(retrieved, start=1)
    )

    history_block = ""
    if history:
        history_block = f"""<conversation_history>

{_format_history(history)}

</conversation_history>

The conversation history is ONLY for understanding what the question refers to
(e.g. which program, course or topic "it" / "that one" means). Never use it as a
source of facts - every fact in your answer must come from <context_documents>.
Do not answer from an earlier assistant reply if the context does not support it.

"""

    return f"""<context_documents>

{context}

</context_documents>

{history_block}<question>

{question}

</question>

Answer the question using only the information inside <context_documents>.

If the answer is not there, respond exactly: "ไม่พบข้อมูลนี้ในระบบ"
"""


def _parse_sse_stream(body: str) -> str:
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
    history: list[dict] | None = None,
) -> str:
    if retrieved is None:
        retrieved = retrieve(db, question, k=k)

    if not retrieved:
        return "ไม่พบข้อมูลนี้ในระบบ"

    prompt = _build_prompt(question, retrieved, history)

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

    try:
        data = json.loads(body_text)
        return data["choices"][0]["message"]["content"].strip()
    except (json.JSONDecodeError, KeyError, IndexError, TypeError):
        pass

    if "data:" in body_text:
        answer = _parse_sse_stream(body_text).strip()

        if answer:
            return answer

    logger.error(
        "[llm] parse response ไม่สำเร็จในทั้งสองรูปแบบ body=%s",
        body_text[:500],
    )

    return "ขออภัย ระบบตอบคำถามขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง"