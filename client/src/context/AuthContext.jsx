// ============================================================
// ไฟล์: client/src/context/AuthContext.jsx
// หน้าที่: "กระดานกลาง" เก็บว่า ตอนนี้ใครล็อกอินอยู่
//   - ทุกหน้าอ่านข้อมูลผู้ใช้จากที่นี่ได้ โดยไม่ต้องส่งต่อทีละชั้น
//   - บันทึกผู้ใช้ลง localStorage ด้วย รีเฟรชหน้าเว็บแล้วยังล็อกอินอยู่
//   - ออกจากระบบ = setUser(null) ที่เดียว ข้อมูลใน localStorage ถูกลบให้เอง
// ============================================================

import { createContext, useState, useEffect } from 'react' // createContext = สร้างกระดานกลาง, useState = จำค่า, useEffect = ทำงานเสริมหลังวาดหน้าเสร็จ

// บรรทัดข้างล่างเป็นคำสั่งบอก ESLint (ตัวตรวจโค้ด) ให้ไม่ต้องเตือนเรื่องไฟล์นี้ export ของที่ไม่ใช่คอมโพเนนต์ (ห้ามลบ และห้ามแทรกอะไรระหว่างมันกับบรรทัดถัดไป)
// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext(null) // สร้างกระดานกลาง ค่าเริ่มต้น null (ใช้ตอนที่ลืมห่อ AuthProvider) และ export ให้ useAuth.js นำไปอ่าน

// AuthProvider = คอมโพเนนต์ "ผู้ให้บริการ" ที่ห่อทั้งแอปใน main.jsx
// { children } = ทุกอย่างที่ถูกห่ออยู่ข้างใน (ในที่นี้คือ <App />)
export function AuthProvider({ children }) {
  // useState คืนคู่ [ค่าปัจจุบัน, ฟังก์ชันเปลี่ยนค่า] → user = ผู้ใช้ปัจจุบัน, setUser = ฟังก์ชันเปลี่ยนผู้ใช้
  // ใส่ "ฟังก์ชัน" ใน useState = รันแค่ครั้งเดียวตอนเปิดแอป เพื่อหาค่าเริ่มต้น
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user') // อ่านข้อความที่เคยบันทึกไว้ชื่อ 'user' (ถ้าไม่มีจะได้ null)
    return saved ? JSON.parse(saved) : null // ถ้ามี: แปลงข้อความกลับเป็นออบเจ็กต์ (JSON.parse) / ถ้าไม่มี: ยังไม่ล็อกอิน = null
  })

  // useEffect = "ทำงานเสริมหลังหน้าวาดเสร็จ" ที่นี่ใช้ซิงก์ค่า user ลง localStorage
  useEffect(() => {
    if (user) {
      // มีผู้ใช้ (ล็อกอินอยู่) → บันทึกลง localStorage (เก็บได้เฉพาะข้อความ จึงแปลงด้วย JSON.stringify ก่อน)
      localStorage.setItem('user', JSON.stringify(user))
    } else {
      // ไม่มีผู้ใช้ (ออกจากระบบ) → ลบข้อมูลทิ้ง
      localStorage.removeItem('user')
    }
  }, [user]) // [user] = ทำงานซ้ำเมื่อ user เปลี่ยนเท่านั้น (ถ้าใส่ [] จะทำแค่ครั้งแรก, ถ้าไม่ใส่จะทำทุกครั้งที่หน้าวาดใหม่)

  // ส่งสิ่งที่จะวาดออกไป
  return (
    // Provider = ปล่อยค่าบนกระดานกลางให้ลูกหลานทุกตัวอ่านได้
    // value={{ user, setUser }} วงเล็บปีกกาชั้นนอก = "นี่คือโค้ด JS" ชั้นใน = ออบเจ็กต์ที่มี user กับ setUser
    <AuthContext.Provider value={{ user, setUser }}>
      {/* children = ทุกหน้าที่ถูกห่อไว้ แสดงผลตามเดิม แต่ตอนนี้มันเรียก useAuth() เพื่ออ่าน user ได้แล้ว */}
      {children}
    </AuthContext.Provider>
  )
}