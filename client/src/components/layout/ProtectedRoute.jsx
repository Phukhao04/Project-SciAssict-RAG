// ============================================================
// ไฟล์: client/src/components/layout/ProtectedRoute.jsx
// หน้าที่: "ยามเฝ้าประตู" ครอบหน้าที่ต้องล็อกอินก่อนถึงจะเข้าได้
//   - ยังไม่ล็อกอิน → ส่งไปหน้า /login
//   - ล็อกอินแล้ว   → ปล่อยให้เห็นหน้าที่ถูกห่ออยู่
//   ใช้ใน App.jsx เช่น <ProtectedRoute><Chat /></ProtectedRoute>
//   หมายเหตุ: ไฟล์นี้กันที่หน้าเว็บเท่านั้น ความปลอดภัยจริงต้องตรวจที่ backend ด้วย
// ============================================================

import { Navigate } from 'react-router-dom' // Navigate = คอมโพเนนต์ "พาไปหน้าอื่น" ทันทีที่ถูกวาด
import { useAuth } from '../../hooks/useAuth' // ทางลัดอ่านผู้ใช้จากกระดานกลาง ('../../' = ถอยขึ้นสองโฟลเดอร์)

// { children } = หน้าที่ถูกห่อไว้ข้างใน (เช่น <Chat />)
function ProtectedRoute({ children }) {
  const { user } = useAuth() // ดึงเฉพาะ user ออกมา (destructuring) ถ้าล็อกอินอยู่จะเป็นออบเจ็กต์ ถ้าไม่ใช่เป็น null

  if (!user) {
    // !user = "ไม่มีผู้ใช้" = ยังไม่ล็อกอิน
    // replace = แทนที่ประวัติหน้าเดิม ผู้ใช้กดปุ่มย้อนกลับแล้วจะไม่วนกลับมาหน้าที่ถูกกัน
    return <Navigate to="/login" replace />
  }

  return children // ผ่านด่านแล้ว → แสดงหน้าที่ห่ออยู่ตามปกติ
}

export default ProtectedRoute // เปิดให้ App.jsx นำไปใช้ได้