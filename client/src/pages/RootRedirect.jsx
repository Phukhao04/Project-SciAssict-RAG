// ============================================================
// ไฟล์: client/src/pages/RootRedirect.jsx
// หน้าที่: ตัวแยกทางตอนเข้าเว็บที่ "/" (หน้าแรก)
//   หน้านี้ไม่แสดงอะไรเลย แค่ส่งต่อทันที
//   - ล็อกอินแล้ว   → ไป /chat
//   - ยังไม่ล็อกอิน → ไป /login
// ============================================================

import { Navigate } from 'react-router-dom' // Navigate = คอมโพเนนต์ "พาไปหน้าอื่น" ทันทีที่ถูกวาด
import { useAuth } from '../hooks/useAuth' // ทางลัดอ่านผู้ใช้จากกระดานกลาง ('../' = ถอยขึ้นหนึ่งโฟลเดอร์)

function RootRedirect() {
  const { user } = useAuth() // ดึง user ออกมา (มีค่า = ล็อกอินอยู่, null = ยังไม่ล็อกอิน)
  // to={ user ? '/chat' : '/login' } = เงื่อนไขแบบย่อ "ถ้ามี user ให้ไป /chat ไม่งั้นไป /login"
  // replace = แทนที่ประวัติ ไม่ให้กดย้อนกลับมาหน้า "/" ที่ไม่มีอะไรแสดง
  return <Navigate to={user ? '/chat' : '/login'} replace />
}

export default RootRedirect // เปิดให้ App.jsx นำไปใช้ได้