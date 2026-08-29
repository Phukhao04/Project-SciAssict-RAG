import AppConfig from "../config/appConfig";
import { authHeaders } from "./authHeaders";

export async function chatRequest(question, userId, sessionId = null, k = 5) {
  const response = await fetch(`${AppConfig.apiBaseUri}/rag/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      ...authHeaders(),
    },
    body: JSON.stringify({ question, k, user_id: userId, session_id: sessionId }),
  });

  const json = await response.json().catch(() => null);

  if (response.status === 200) {
    return { isError: false, answer: json.answer, sources: json.sources || [], sessionId: json.session_id };
  }

  return {
    isError: true, answer: "", sources: [], sessionId: null,
    errorMessage: json?.detail || "ระบบตอบคำถามขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง",
  };
}

export async function getSessions() {
  const response = await fetch(`${AppConfig.apiBaseUri}/chat/sessions`, {
    headers: { ...authHeaders() },
  });
  if (response.status !== 200) return [];
  return await response.json();
}

export async function getSessionMessages(sessionId) {
  const response = await fetch(`${AppConfig.apiBaseUri}/chat/sessions/${sessionId}/messages`, {
    headers: { ...authHeaders() },
  });
  if (response.status !== 200) return [];
  return await response.json();
}