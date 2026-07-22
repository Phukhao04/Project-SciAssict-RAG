import AppConfig from "../config/appConfig";

// ทำไมแยกไฟล์จาก authService.js: เป็นคนละโดเมนงานกัน (RAG vs Authentication)
// เก็บรวมกันจะทำให้ไฟล์เดียวทำหน้าที่ปนกันมากเกินไป

export async function chatRequest(question, userId, sessionId = null, k = 5) {
  const response = await fetch(`${AppConfig.apiBaseUri}/rag/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
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

export async function getSessions(userId) {
  const response = await fetch(`${AppConfig.apiBaseUri}/chat/sessions/${userId}`);
  if (response.status !== 200) return [];
  return await response.json();
}

export async function getSessionMessages(sessionId) {
  const response = await fetch(`${AppConfig.apiBaseUri}/chat/sessions/${sessionId}/messages`);
  if (response.status !== 200) return [];
  return await response.json();
}