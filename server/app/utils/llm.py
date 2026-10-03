import json
import logging

import httpx
from sqlalchemy.orm import Session

from .retrieval import retrieve
from app.prompts.rag_system_prompt import SYSTEM_PROMPT, PROMPT_VERSION
from app.config import settings

logger = logging.getLogger(__name__)

DOTBLUE_CHAT_URL = "https://ai.psu.blue/v1/chat/completions"

# จำกัดความยาวข้อความแต่ละอันในประวัติ กัน prompt บวม (คำตอบบอทมักยาวสุด)
HISTORY_CHAR_LIMIT = 400


def _build_context_block(index: int, chunk) -> str:
    """สร้าง <context> block เดียว จาก 1 chunk ที่ retrieve มาได้ ใช้ parent_text"""
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


def _build_prompt(question: str, retrieved: list, history: list[dict] | None = None) -> str:
    """ประกอบ context blocks + (ประวัติสนทนา) + คำถาม เข้าเป็น prompt เดียว"""
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


def _extract_answer_text(body_text: str) -> str:
    """แกะข้อความตอบจาก response ทั้งแบบ JSON ก้อนเดียวและ SSE (คืน "" ถ้าแกะไม่ได้)"""
    try:
        data = json.loads(body_text)
        return data["choices"][0]["message"]["content"].strip()
    except (json.JSONDecodeError, KeyError, IndexError, TypeError):
        pass

    if "data:" in body_text:
        return _parse_sse_stream(body_text).strip()

    return ""


def rewrite_query(
    question: str,
    history: list[dict] | None,
    model: str = "PSU-LLM/psu-gemma",
) -> str:
    """
    แปลงคำถามต่อเนื่อง (เช่น "แล้วมีกี่หน่วยกิต", "วิชานี้ใครสอน") ให้เป็นคำถาม
    ที่สมบูรณ์ในตัวเอง ก่อนเอาไป retrieve เพราะ vector search ไม่เห็นประวัติแชท
    ถ้าไม่มีประวัติ หรือ rewrite พลาดด้วยเหตุใดก็ตาม -> คืนคำถามเดิม (fail-safe)
    """
    if not history:
        return question

    prompt = f"""Below is a conversation between a user and an assistant for the Faculty of Science, PSU, followed by the user's latest question.

Rewrite the latest question as ONE standalone Thai question that can be understood without the conversation.
- Replace pronouns and omitted subjects (e.g. "วิชานี้", "หลักสูตรนั้น", "แล้วปี 2 ล่ะ") with the specific program, course code or topic from the conversation.
- Keep every course code, number and name exactly as written.
- If the latest question is already standalone, return it unchanged.
- Do NOT answer the question. Output only the rewritten question, nothing else.

<conversation>
{_format_history(history)}
</conversation>

<latest_question>
{question}
</latest_question>"""

    try:
        http_response = httpx.post(
            DOTBLUE_CHAT_URL,
            headers={
                "Authorization": f"Bearer {settings.dotblue_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "max_tokens": 200,
                "stream": False,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=30,
            follow_redirects=True,
        )
    except Exception:
        logger.exception("[llm] rewrite_query เรียก LLM ไม่สำเร็จ ใช้คำถามเดิมแทน")
        return question

    if http_response.status_code >= 400:
        logger.error(
            "[llm] rewrite_query status=%s ใช้คำถามเดิมแทน", http_response.status_code
        )
        return question

    rewritten = _extract_answer_text(http_response.text)
    rewritten = rewritten.strip().strip('"').strip("'").strip() if rewritten else ""
    # เอาแค่บรรทัดแรก กันโมเดลพ่นคำอธิบายต่อท้าย
    rewritten = rewritten.splitlines()[0].strip() if rewritten else ""

    if not rewritten or len(rewritten) > 300:
        return question

    logger.info("[llm] rewrite_query: %r -> %r", question, rewritten)
    return rewritten


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