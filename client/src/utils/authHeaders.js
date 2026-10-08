// ============================================================
// ไฟล์: client/src/utils/authHeaders.js
// หน้าที่: สร้าง header ที่แนบ "บัตรผ่าน (JWT)" ไปกับคำขอหา backend
//   ทุกหน้าที่ต้องยืนยันตัวตนเรียกใช้ฟังก์ชันนี้ เช่น headers: { ...authHeaders() }
//   backend อ่าน header ตัวนี้เพื่อรู้ว่า "ใครเป็นคนเรียก"
// ============================================================

// แนบ JWT token ที่เก็บใน localStorage ให้ทุก request ที่ต้องยืนยันตัวตน
// เดิม logic นี้ถูก copy วางซ้ำอยู่หลายไฟล์ (ragService, userService,
// DocumentManagement, UserManagement) — รวมมาไว้ที่เดียวให้แก้ครั้งเดียวพอ
export function authHeaders() {
  // อ่านบัตรผ่านที่ authService.js บันทึกไว้ตอนล็อกอินสำเร็จ (ถ้ายังไม่ล็อกอินจะได้ null)
  const token = localStorage.getItem("access_token");
  // ถ้ามี token → คืนออบเจ็กต์ { Authorization: "Bearer <token>" } (รูปแบบมาตรฐาน "Bearer" ตามด้วยช่องว่างและ token)
  // ถ้าไม่มี  → คืนออบเจ็กต์ว่าง {} (ไม่แนบอะไร)
  // รูปแบบ  เงื่อนไข ? ค่าถ้าจริง : ค่าถ้าเท็จ  คือ if/else แบบย่อ
  return token ? { Authorization: `Bearer ${token}` } : {};
}