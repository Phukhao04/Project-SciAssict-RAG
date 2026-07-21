import AppConfig from "../config/appConfig";

function getAuthHeaders() {
  const token = localStorage.getItem("access_token");
  return {
    "Content-Type": "application/json; charset=UTF-8",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ดึงรายการ session ทั้งหมดของ user
export async function getSessions(userId) {
  const response = await fetch(
    `${AppConfig.apiBaseUri}/chat/sessions/${userId}`,
    {
      method: "GET",
      headers: getAuthHeaders(),
    }
  );

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      isError: true,
      data: null,
      errorMessage: json?.detail || "โหลดประวัติการสนทนาไม่สำเร็จ",
    };
  }

  return { isError: false, data: json, errorMessage: "" };
}

// ดึงข้อความทั้งหมดใน session หนึ่ง
export async function getMessages(sessionId) {
  const response = await fetch(
    `${AppConfig.apiBaseUri}/chat/sessions/${sessionId}/messages`,
    {
      method: "GET",
      headers: getAuthHeaders(),
    }
  );

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      isError: true,
      data: null,
      errorMessage: json?.detail || "โหลดข้อความไม่สำเร็จ",
    };
  }

  return { isError: false, data: json, errorMessage: "" };
}