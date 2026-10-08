// ============================================================
// ไฟล์: client/src/config/appConfig.js
// หน้าที่: เก็บ "ที่อยู่ของ backend" ไว้ที่เดียว
//   ไฟล์อื่นเรียก AppConfig.apiBaseUri เพื่อต่อ URL ไปหา server
//   ถ้าย้าย server ไปที่ใหม่ แก้ที่นี่ (หรือในไฟล์ .env) จุดเดียวพอ
// ============================================================

// import.meta.env = ค่าตั้งค่าที่ Vite อ่านมาจากไฟล์ .env (เฉพาะชื่อที่ขึ้นต้นด้วย VITE_)
// || = "หรือ" ถ้าฝั่งซ้ายไม่มีค่า ให้ใช้ฝั่งขวาแทน
// ผล: ถ้าไม่ได้ตั้ง VITE_API_BASE_URL ใน .env จะใช้ http://localhost:8000 (server บนเครื่องตัวเองตอนพัฒนา)
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// รวมที่อยู่ไว้ในออบเจ็กต์เดียว
const AppConfig = {
  apiBase: API_BASE, // ที่อยู่หลักของ server เช่น http://localhost:8000 (ใช้กับดาวน์โหลดไฟล์ และ endpoint ที่ขึ้นต้น /api เอง)
  apiBaseUri: `${API_BASE}/api`, // ที่อยู่ + /api  (`...${}...` = template string แทรกตัวแปรลงในข้อความ) → http://localhost:8000/api
};

export default AppConfig; // เปิดให้ไฟล์อื่น import AppConfig ไปใช้ได้