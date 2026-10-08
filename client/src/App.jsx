// ============================================================
// ไฟล์: client/src/App.jsx
// หน้าที่: "ตารางเส้นทาง" บอกว่า URL ไหนให้แสดงหน้าไหน
//   เช่น /login → หน้า Login, /chat → หน้า Chat
//   ถ้าอาจารย์ให้เพิ่มหน้าใหม่ ต้องมาเพิ่ม <Route> ที่ไฟล์นี้
// ============================================================

import { Routes, Route } from 'react-router-dom' // Routes = กรอบที่ครอบตารางเส้นทาง, Route = เส้นทาง 1 เส้น
import Login from './pages/Login' // หน้าเข้าสู่ระบบ / สมัครสมาชิก
import Chat from './pages/Chat' // หน้าแชตถามตอบ
import Dashboard from './pages/admin/Dashboard' // หน้าภาพรวมระบบของแอดมิน
import UploadDocument from './pages/admin/UploadDocument' // หน้าอัปโหลดเอกสาร (แอดมิน)
import DocumentManagement from './pages/admin/DocumentManagement' // หน้ารายการเอกสารทั้งหมด (แอดมิน)
import DocumentChunks from './pages/admin/DocumentChunks' // หน้าดู/แก้ chunk ของเอกสาร 1 ฉบับ (แอดมิน)
import UserManagement from './pages/admin/UserManagement' // หน้าจัดการผู้ใช้ (แอดมิน)
import ProtectedRoute from './components/layout/ProtectedRoute' // "ยามเฝ้าประตู" กันคนที่ยังไม่ล็อกอิน
import RootRedirect from './pages/RootRedirect' // หน้าที่ไม่แสดงอะไร แต่ส่งต่อไป /chat หรือ /login
import Profile from './pages/Profile' // หน้าแก้ไขข้อมูลส่วนตัว

// คอมโพเนนต์ App = ฟังก์ชันที่คืนค่า "หน้าตา" (JSX) ออกมา  
function App() {
  // return ( ... ) = ส่งสิ่งที่อยู่ในวงเล็บออกไปให้ React วาด
  return (
    // <Routes> ดู URL ปัจจุบัน แล้วเลือกแสดงเฉพาะ <Route> ที่ตรงกัน 1 อัน
    <Routes>
      {/* path="/" = เข้าเว็บหน้าแรก → RootRedirect จะส่งต่อไปหน้าที่เหมาะสมให้เอง */}
      <Route path="/" element={<RootRedirect />} />
      {/* path="/login" = หน้าล็อกอิน ไม่ต้องมียามเฝ้า เพราะต้องให้คนที่ยังไม่ล็อกอินเข้าได้ */}
      <Route path="/login" element={<Login />} />

      {/* /chat = หน้าแชต ห่อด้วย ProtectedRoute: ถ้ายังไม่ล็อกอินจะถูกส่งไป /login */}
      <Route
        path="/chat"
        element={<ProtectedRoute>
          <Chat />
        </ProtectedRoute>} />

      {/* /admin = Dashboard ภาพรวมระบบ (ต้องล็อกอินก่อน) */}
      <Route
        path="/admin"
        element={<ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>} />
      {/* /admin/upload = อัปโหลดเอกสารเข้าฐานความรู้ (ต้องล็อกอินก่อน) */}
      <Route
        path="/admin/upload"
        element={<ProtectedRoute>
          <UploadDocument />
        </ProtectedRoute>} />
      {/* /admin/documents = รายการเอกสารทั้งหมด (ต้องล็อกอินก่อน) */}
      <Route
        path="/admin/documents"
        element={<ProtectedRoute>
          <DocumentManagement />
        </ProtectedRoute>} />
      {/* /admin/documents/:id = รายละเอียดเอกสาร  ":id" คือส่วนที่เปลี่ยนได้ เช่น /admin/documents/7
          หน้า DocumentChunks จะอ่านเลข 7 ออกมาด้วย useParams() */}
      <Route
        path="/admin/documents/:id"
        element={<ProtectedRoute>
          <DocumentChunks />
        </ProtectedRoute>} />
      {/* /admin/users = จัดการผู้ใช้และสิทธิ์ (ต้องล็อกอินก่อน) */}
      <Route
        path="/admin/users"
        element={<ProtectedRoute>
          <UserManagement />
        </ProtectedRoute>} />
      {/* /profile = แก้ไขข้อมูลส่วนตัว (ต้องล็อกอินก่อน) */}
      <Route
        path="/profile"
        element={<ProtectedRoute>
          <Profile />
        </ProtectedRoute>} />
    </Routes>
  )
}

// export default = เปิดให้ไฟล์อื่น (main.jsx) นำ App ไปใช้ได้
export default App