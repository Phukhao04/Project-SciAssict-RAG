// ============================================================
// ไฟล์: client/src/main.jsx
// หน้าที่: "จุดเริ่มต้น" ของหน้าเว็บทั้งหมด (ไฟล์แรกที่ถูกรัน)
//   index.html มีกล่องว่างๆ ชื่อ root อยู่ ไฟล์นี้สั่งให้ React
//   "วาดแอปทั้งหมดลงในกล่องนั้น"
// ============================================================

import { StrictMode } from 'react' // StrictMode = โหมดช่วยเตือนข้อผิดพลาดตอนพัฒนา (ไม่มีผลตอนใช้งานจริง)
import { createRoot } from 'react-dom/client' // createRoot = ฟังก์ชันที่ผูก React เข้ากับหน้าเว็บจริง (DOM)
import { BrowserRouter } from 'react-router-dom' // BrowserRouter = ระบบเปลี่ยนหน้าตาม URL (เช่น /login, /chat)
import { AuthProvider } from './context/AuthContext.jsx' // AuthProvider = "กระดานกลาง" เก็บข้อมูลผู้ใช้ที่ล็อกอิน
import './index.css' // นำเข้า CSS พื้นฐานของทั้งแอป (ไม่ต้องตั้งชื่อตัวแปร แค่นำเข้ามาใช้)
import App from './App.jsx' // App = คอมโพเนนต์หลักที่มีตารางเส้นทางของทุกหน้า

// document.getElementById('root') = ไปหา <div id="root"> ใน index.html
// createRoot(...) = บอก React ว่า "ฉันจะวาดแอปลงในกล่องนี้"
// .render(...) = สั่งวาด สิ่งที่อยู่ในวงเล็บคือสิ่งที่จะถูกวาด
createRoot(document.getElementById('root')).render(
  // StrictMode ห่อนอกสุด: ตรวจจับปัญหาในโค้ดให้ทั้งแอป
  <StrictMode>
    {/* BrowserRouter: เปิดระบบ URL ให้ทุกอย่างข้างใน (ต้องอยู่นอก App เพื่อให้ App ใช้ Route ได้) */}
    <BrowserRouter>
      {/* AuthProvider: เปิด "กระดานกลางผู้ใช้" ให้ทุกหน้าข้างใน อ่านด้วย useAuth() ได้ */}
      <AuthProvider>
        {/* App: ตัวแอปจริง (ตารางเส้นทาง + ทุกหน้า) อยู่ชั้นในสุด */}
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>, // เครื่องหมายจุลภาคท้ายบรรทัดเป็นรูปแบบเดิมของโค้ด (ไม่ต้องลบ)
)