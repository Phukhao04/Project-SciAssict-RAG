// ============================================================
// ไฟล์: client/src/utils/dateUtil.js
// หน้าที่: แปลงวันที่ให้เป็นข้อความรูปแบบ  วัน-เดือน-ปี  เช่น 05-10-2026
//   ใช้ตอนล็อกอิน (authService.js) รูปแบบนี้ต้อง "ตรงกัน" กับที่ backend สร้าง
//   (ฟังก์ชัน get_current_date_for_token ฝั่ง server ใช้ %d-%m-%Y เหมือนกัน)
//   ถ้าแก้รูปแบบฝั่งนี้ฝั่งเดียว การล็อกอินจะไม่ผ่าน
// ============================================================

// date = ออบเจ็กต์วันที่ของ JavaScript (เช่น new Date())
export function getFormattedDate(date) {
  // date.getDate() = วันที่ในเดือน (1-31) ได้เป็นตัวเลข
  // String(...) = แปลงเป็นข้อความ  /  padStart(2, "0") = ถ้าไม่ถึง 2 ตัวอักษร เติม "0" ข้างหน้า (5 → "05")
  const day = String(date.getDate()).padStart(2, "0");
  // date.getMonth() เริ่มนับเดือนจาก 0 (ม.ค. = 0) จึงต้อง +1 ให้เป็นเดือนจริง แล้วเติม 0 ข้างหน้าให้ครบ 2 หลัก
  const month = String(date.getMonth() + 1).padStart(2, "0");
  // date.getFullYear() = ปี ค.ศ. 4 หลัก (เช่น 2026)
  const year = date.getFullYear();
  // ต่อเป็นข้อความรูปแบบ วัน-เดือน-ปี (template string) เช่น "05-10-2026"
  return `${day}-${month}-${year}`;
}