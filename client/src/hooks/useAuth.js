// ============================================================
// ไฟล์: client/src/hooks/useAuth.js
// หน้าที่: "ทางลัด" อ่านข้อมูลจากกระดานกลาง (AuthContext)
//   หน้าอื่นๆ แค่เขียน  const { user, setUser } = useAuth()
//   แทนที่จะต้องเขียน useContext(AuthContext) เองทุกครั้ง
//   (ชื่อที่ขึ้นต้นด้วย use = Hook ของ React)
// ============================================================

import { useContext } from 'react' // useContext = Hook สำหรับ "อ่านค่า" จากกระดานกลาง
import { AuthContext } from '../context/AuthContext' // นำกระดานกลางที่สร้างไว้ใน AuthContext.jsx มาใช้ ('../' = ถอยขึ้นหนึ่งโฟลเดอร์)

// export = เปิดให้ไฟล์อื่นเรียกใช้ useAuth ได้
export function useAuth() {
  const context = useContext(AuthContext) // อ่านค่าจากกระดานกลาง ได้ { user, setUser } (หรือ null ถ้าไม่ได้ถูกห่อด้วย AuthProvider)
  if (!context) {
    // !context = "context ว่าง/เป็น null" แปลว่าหน้านี้อยู่นอก <AuthProvider>
    // throw new Error(...) = หยุดโปรแกรมแล้วแจ้งข้อผิดพลาดที่อ่านรู้เรื่อง (ช่วยหาจุดที่ลืมห่อได้เร็ว)
    throw new Error('useAuth ต้องถูกใช้ภายใน AuthProvider เท่านั้น')
  }
  return context // ส่งค่า { user, setUser } กลับให้หน้าที่เรียก
}