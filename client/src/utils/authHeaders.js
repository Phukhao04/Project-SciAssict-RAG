// แนบ JWT token ที่เก็บใน localStorage ให้ทุก request ที่ต้องยืนยันตัวตน
// เดิม logic นี้ถูก copy วางซ้ำอยู่หลายไฟล์ (ragService, userService,
// DocumentManagement, UserManagement) — รวมมาไว้ที่เดียวให้แก้ครั้งเดียวพอ
export function authHeaders() {
  const token = localStorage.getItem("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
