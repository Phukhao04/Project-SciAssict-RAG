import logging
from uuid import uuid4

import httpx
from sqlalchemy.orm import Session

from .retrieval import retrieve
from app.prompts.rag_system_prompt import SYSTEM_PROMPT, PROMPT_VERSION
from app.config import settings

logger = logging.getLogger(__name__)

ANTHROPIC_BASE_URL = "https://ai.psu.blue/anthropic"
OPENAI_BASE_URL = "https://ai.psu.blue/openai"

def _build_context_block(index: int, chunk) -> str:
    return (
        f'<context index="{index}" source="{chunk.document_name}">\n'
        f"{chunk.parent_text}\n"
        f"</context>"
    )


def _build_prompt(question: str, retrieved: list) -> str:
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


def _generate_with_anthropic(prompt: str, model: str) -> str:
    # The PSU gateway currently requires conversationId even though the
    # standard Anthropic Messages API does not expose it as a normal field.
    # Send the request directly so conversationId is present at the top level.
    conversation_id = str(uuid4())

    response = httpx.post(
        f"{ANTHROPIC_BASE_URL}/v1/messages",
        headers={
            "x-api-key": settings.dotblue_api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "system": SYSTEM_PROMPT,
            "max_tokens": 1024,
            "messages": [{"role": "user", "content": prompt}],
            "conversationId": conversation_id,
        },
        timeout=90.0,
    )
    response.raise_for_status()

    data = response.json()
    content = data.get("content") or []
    if not content:
        raise RuntimeError(f"LLM gateway returned no content: {data}")

    answer = content[0].get("text")
    if not answer:
        raise RuntimeError(f"LLM gateway returned empty content: {data}")

    return answer.strip()


def _generate_with_openai_compatible(prompt: str, model: str) -> str:
    # Fallback for the same PSU gateway when its Anthropic adapter is unavailable.
    # The endpoint is OpenAI-compatible and uses the same dotBLUE API key.
    conversation_id = str(uuid4())

    response = httpx.post(
        f"{OPENAI_BASE_URL}/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {settings.dotblue_api_key}",
            "Content-Type": "application/json",
            "X-Conversation-Id": conversation_id,
        },
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 1024,
        },
        timeout=90.0,
    )
    response.raise_for_status()

    # The PSU OpenAI-compatible endpoint currently returns the generated
    # answer as plain text rather than an OpenAI JSON envelope.
    content_type = response.headers.get("content-type", "").lower()
    if "application/json" in content_type:
        data = response.json()
        choices = data.get("choices") or []
        if not choices:
            raise RuntimeError(f"LLM gateway returned no choices: {data}")

        content = choices[0].get("message", {}).get("content")
        if not content:
            raise RuntimeError(f"LLM gateway returned an empty answer: {data}")

        return content.strip()

    content = response.text.strip()
    if not content:
        raise RuntimeError("LLM gateway returned an empty response")

    return content


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
    logger.debug("[llm] prompt (%s):\n%s", PROMPT_VERSION, prompt)

    try:
        return _generate_with_anthropic(prompt, model)

    except Exception:
        logger.exception("[llm] Anthropic gateway failed; trying OpenAI-compatible fallback")

        try:
            return _generate_with_openai_compatible(prompt, model)

        except Exception:
            logger.exception("[llm] OpenAI-compatible gateway fallback failed")
            return "ขออภัย ระบบตอบคำถามขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง"
