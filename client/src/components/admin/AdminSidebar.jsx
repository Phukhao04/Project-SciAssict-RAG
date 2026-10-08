// ============================================================
// ไฟล์: client/src/components/admin/AdminSidebar.jsx
//
// หน้าที่:
//   1) แสดงโลโก้และชื่อระบบ
//   2) แสดงลิงก์ไปหน้าแอดมินต่าง ๆ และหน้าแชท
//   3) ไฮไลต์เมนูที่ตรงกับ URL ปัจจุบัน
//   4) เปิดหรือปิดเมนูสำหรับมือถือ
//   5) แสดงชื่อผู้ใช้ และเมนูออกจากระบบ
//
// AdminLayout.jsx เป็นผู้เรียกใช้ <AdminSidebar />
//
// คำที่ควรรู้:
//   component = ส่วนหน้าจอที่เขียนแยกไว้และเรียกใช้ซ้ำได้
//   state = ค่าที่ React เก็บไว้ เมื่อเปลี่ยนค่าจะอัปเดตหน้าจอ
//   hook = ฟังก์ชันของ React หรือของโปรเจกต์ เช่น useState, useAuth
//   JSX = รูปแบบเขียนหน้าจอที่มีหน้าตาคล้าย HTML
//
// การเขียนคอมเมนต์:
//   นอก JSX ใช้ // หรือ /* ... */
//   ภายใน JSX ใช้ {/* ... */}
// ============================================================

// Link = ลิงก์เปลี่ยนหน้าผ่าน React Router
// useLocation = อ่าน URL ปัจจุบัน เช่น pathname เป็น "/admin"
// useNavigate = รับฟังก์ชันสำหรับเปลี่ยนหน้าด้วยคำสั่งในโค้ด
import { Link, useLocation, useNavigate } from 'react-router-dom'

// นำเข้า useState เพื่อเก็บสถานะเปิดหรือปิดเมนู
import { useState } from 'react'

// นำเข้า hook ของโปรเจกต์ เพื่ออ่านและแก้ข้อมูลผู้ใช้ใน AuthContext
import { useAuth } from '../../hooks/useAuth'

// โหลด CSS ที่จัดหน้าตาของเมนูด้านข้าง
import './AdminSidebar.css'

/* โลโก้อะตอมเดียวกับหน้าแชท ให้สอง section ของระบบดูเป็นชุดเดียวกัน */

// สร้าง component ไอคอนอะตอมด้วย arrow function
// { size, color } = ดึงค่าจาก props ที่ผู้เรียกส่งมา
// size = 18 และ color = '#0B1150' เป็นค่าเริ่มต้น
// จะใช้ค่าเริ่มต้นเมื่อไม่ได้ส่งค่านั้น หรือส่ง undefined
// => (...) = คืน JSX ในวงเล็บทันที โดยไม่ต้องเขียน return
const AtomIcon = ({ size = 18, color = '#0B1150' }) => (

  // svg = ภาพที่วาดด้วยรูปทรงและเส้น
  // viewBox = กำหนดพื้นที่พิกัดภายในภาพเป็น 24 × 24
  // width และ height = ขนาดที่แสดงจริง ใช้ค่าจาก size
  // fill="none" = ไม่เติมสีพื้นให้รูปทรงโดยค่าเริ่มต้น
  // stroke={color} = ใช้ color เป็นสีเส้น
  // strokeWidth="1.7" = ความหนาของเส้น
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.7">

    {/* วาดวงรีวงแรก
        cx, cy = พิกัดจุดศูนย์กลาง
        rx, ry = รัศมีแนวนอนและแนวตั้ง */}
    <ellipse cx="12" cy="12" rx="10" ry="4.2" />

    {/* วาดวงรีแบบเดิม แต่หมุน 60 องศารอบจุด (12, 12) */}
    <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(60 12 12)" />

    {/* วาดวงรีอีกวง แล้วหมุน 120 องศา
        สามวงรวมกันจึงดูเหมือนวงโคจรของอะตอม */}
    <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(120 12 12)" />

    {/* วาดจุดกลางอะตอม
        r = รัศมีวงกลม
        fill={color} = เติมสีเดียวกับเส้น
        stroke="none" = ไม่วาดเส้นขอบ */}
    <circle cx="12" cy="12" r="1.8" fill={color} stroke="none" />

  {/* จบภาพ SVG */}
  </svg>

) // จบ component AtomIcon

// สร้าง component ไอคอนออกจากระบบ
// () ว่าง = ไม่รับ props มาใช้งานในฟังก์ชันนี้
const LogoutIcon = () => (

  // ขนาดไอคอน 14 × 14
  // currentColor = ใช้สีจากค่า CSS color ของ element
  // strokeLinecap="round" = ปลายเส้นมน
  // strokeLinejoin="round" = มุมที่เส้นต่อกันเป็นมุมมน
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">

    {/* บรรทัดเดิมประกอบด้วยรูปทรงสามส่วน:
        path = เส้นรูปประตู โดย d เก็บคำสั่งและพิกัดวาดเส้น
        polyline = เส้นต่อหลายจุด วาดหัวลูกศร
        line = เส้นตรง วาดก้านลูกศร */}
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />

  </svg>

) // จบ component LogoutIcon

// สร้าง component หลักของเมนูด้านข้าง
function AdminSidebar() {

  // อ่านข้อมูล URL ปัจจุบัน
  // เช่น location.pathname เป็น "/admin/documents"
  const location = useLocation()

  // รับฟังก์ชัน navigate ไว้สั่งเปลี่ยนหน้า
  const navigate = useNavigate()

  // ดึงข้อมูลจาก AuthContext ผ่าน useAuth
  // user = ข้อมูลผู้ใช้ปัจจุบัน
  // setUser = ฟังก์ชันเปลี่ยนข้อมูลผู้ใช้ใน context
  const { user, setUser } = useAuth()

  // เก็บว่าเมนูย่อยของผู้ใช้เปิดอยู่หรือไม่
  // false = เริ่มต้นปิดเมนู
  // setShowUserMenu(...) = เปลี่ยนค่าแล้วให้ React อัปเดตหน้าจอ
  const [showUserMenu, setShowUserMenu] = useState(false)

  // เก็บว่าเมนูสำหรับมือถือเปิดอยู่หรือไม่
  // ค่าเริ่มต้น false = ปิด
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  // ฟังก์ชันตรวจว่า path ที่ส่งมา ตรงกับ URL ปัจจุบันหรือไม่
  // === = เทียบทั้งค่าและชนิดข้อมูล
  // คืน true ถ้าตรงกัน และ false ถ้าไม่ตรงกัน
  //
  // เช่น isActive('/admin') จะเป็น true เมื่ออยู่ที่ /admin
  // เป็นการเทียบแบบตรงกันทั้งข้อความ
  // /admin/documents/123 จึงไม่ตรงกับ /admin/documents
  const isActive = (path) => location.pathname === path

  // ฟังก์ชันที่ทำงานเมื่อกดออกจากระบบ
  const handleLogout = () => {

    // ตั้งข้อมูลผู้ใช้ใน AuthContext เป็น null
    // การจัดการข้อมูลที่เก็บไว้เพิ่มเติมขึ้นอยู่กับ AuthContext
    setUser(null)

    // เปลี่ยนไปหน้าเข้าสู่ระบบ
    navigate('/login')

  } // จบ handleLogout

  // เตรียมตัวอักษรที่จะแสดงในรูปโปรไฟล์
  // user?.username = อ่าน username โดยไม่ error ถ้า user เป็น null
  //
  // เงื่อนไข ? ค่าถ้าจริง : ค่าถ้าเท็จ เรียกว่า ternary operator
  // ถ้ามี username:
  //   user.username[0] = ตัวอักษรแรกของชื่อ
  //   .toUpperCase() = เปลี่ยนเป็นตัวพิมพ์ใหญ่
  // ถ้าไม่มี username ให้แสดง 'A'
  const avatarLetter = user?.username ? user.username[0].toUpperCase() : 'A'

  // คืนหน้าจอเมนูด้านข้างให้ React แสดง
  return (

    // aside = ส่วนประกอบข้างเนื้อหาหลัก
    // ถ้า isMobileOpen เป็น true ให้เพิ่มคลาส is-mobile-open
    // CSS จะใช้คลาสนี้กำหนดหน้าตาเมนูในสถานะเปิด
    <aside className={isMobileOpen ? "admin-sidebar is-mobile-open" : "admin-sidebar"}>

      {/* ปุ่มสลับสถานะเมนูสำหรับมือถือ */}
      <button

        // type="button" = ปุ่มทั่วไป ไม่ใช่ปุ่มส่งฟอร์ม
        type="button"

        // คลาสสำหรับจัดหน้าตาปุ่มใน CSS
        className="admin-mobile-toggle"

        // ชื่อปุ่มสำหรับโปรแกรมอ่านหน้าจอ
        aria-label="เปิดหรือปิดเมนูผู้ดูแลระบบ"

        // แจ้งโปรแกรมอ่านหน้าจอว่าเมนูเปิดอยู่หรือไม่
        aria-expanded={isMobileOpen}

        // เมื่อคลิก ให้เปลี่ยนสถานะเป็นค่าตรงข้าม
        // v = ค่าสถานะก่อนหน้า
        // !v = ถ้าเดิม false เปลี่ยนเป็น true และกลับกัน
        onClick={() => setIsMobileOpen((v) => !v)}

      >☰</button>

      {/* ส่วนบนของ sidebar: โลโก้ ชื่อระบบ และลิงก์เมนู */}
      <div className="admin-sidebar-top">

        {/* กลุ่มโลโก้กับชื่อระบบ */}
        <div className="admin-brand-row">

          {/* เรียก AtomIcon โดยกำหนดขนาด 18
              ไม่ได้ส่ง color จึงใช้สีเริ่มต้นของ AtomIcon */}
          <div className="admin-brand-logo"><AtomIcon size={18} /></div>

          {/* กลุ่มข้อความข้างโลโก้ */}
          <div>

            {/* ชื่อระบบ ถ้าต้องเปลี่ยนข้อความ ให้แก้ตรงนี้ */}
            <p className="admin-brand">Sci Assistant</p>

            {/* ข้อความรองใต้ชื่อระบบ */}
            <p className="admin-brand-sub">PSU - Admin Portal</p>

          </div>
        </div>

        {/* หัวข้อกลุ่มเมนูภาพรวม */}
        <p className="sidebar-group-label">OVERVIEW</p>

        {/* ul = รายการเมนู โดยแต่ละรายการอยู่ใน li */}
        <ul className="admin-menu">
          <li>

            {/* ลิงก์ไปหน้า Dashboard */}
            <Link

              // URL ปลายทางเมื่อคลิก
              to="/admin"

              // ถ้าอยู่หน้า /admin ให้เพิ่มคลาส active
              // CSS ใช้ active เพื่อทำให้เมนูนี้เด่นขึ้น
              className={isActive('/admin') ? 'admin-menu-item active' : 'admin-menu-item'}

            >
              ภาพรวมระบบ
            </Link>

          </li>
          <li>

            {/* ลิงก์ไปหน้าแชท
                onClick ปิดเมนูมือถือด้วยการตั้ง isMobileOpen เป็น false
                className มีสองคลาสสำหรับจัดหน้าตา */}
            <Link to="/chat" onClick={() => setIsMobileOpen(false)} className="admin-menu-item admin-menu-item-back">
              ← ไปหน้าแชท
            </Link>

          </li>
        </ul>

        {/* หัวข้อกลุ่มเมนูเอกสาร */}
        <p className="sidebar-group-label">DOCUMENTS</p>

        {/* รายการเมนูเกี่ยวกับเอกสาร */}
        <ul className="admin-menu">
          <li>

            {/* ลิงก์ไปหน้าอัปโหลด */}
            <Link

              // ปลายทางของลิงก์
              to="/admin/upload"

              // เพิ่ม active เมื่อ URL ปัจจุบันตรงกับ /admin/upload
              className={isActive('/admin/upload') ? 'admin-menu-item active' : 'admin-menu-item'}

            >
              อัปโหลดเอกสาร
            </Link>

          </li>
          <li>

            {/* ลิงก์ไปหน้ารายการเอกสาร */}
            <Link

              // ปลายทางของลิงก์
              to="/admin/documents"

              // เพิ่ม active เมื่อ URL ปัจจุบันตรงกับ /admin/documents
              className={isActive('/admin/documents') ? 'admin-menu-item active' : 'admin-menu-item'}

            >
              จัดการเอกสาร
            </Link>

          </li>
        </ul>

        {/* รายการเมนูจัดการผู้ใช้ */}
        <ul className="admin-menu">
          <li>

            {/* ลิงก์ไปหน้าจัดการผู้ใช้ */}
            <Link

              // ปลายทางของลิงก์
              to="/admin/users"

              // เพิ่ม active เมื่อ URL ปัจจุบันตรงกับ /admin/users
              className={isActive('/admin/users') ? 'admin-menu-item active' : 'admin-menu-item'}

            >
              จัดการผู้ใช้งาน
            </Link>

          </li>
        </ul>

      {/* จบส่วนโลโก้และรายการเมนู */}
      </div>

      {/* ส่วนข้อมูลผู้ใช้และเมนูออกจากระบบ */}
      <div className="admin-sidebar-user-wrap">

        {/* && = ถ้าด้านซ้ายเป็น true จึงแสดง JSX ด้านขวา
            ดังนั้นเมนูออกจากระบบจะแสดงเมื่อ showUserMenu เป็น true */}
        {showUserMenu && (
          <div className="admin-user-menu">

            {/* เมื่อคลิก จะเรียก handleLogout
                เขียนชื่อฟังก์ชันโดยไม่ใส่ () เพื่อให้เรียกตอนคลิก */}
            <button className="admin-user-menu-item" onClick={handleLogout}>

              {/* แสดงไอคอนพร้อมข้อความออกจากระบบ */}
              <LogoutIcon /> ออกจากระบบ

            </button>
          </div>
        )}

        {/* คลิกบริเวณข้อมูลผู้ใช้เพื่อเปิดหรือปิดเมนูย่อย
            v = ค่า showUserMenu ก่อนหน้า
            !v = สลับเป็นค่าตรงข้าม */}
        <div className="admin-sidebar-user" onClick={() => setShowUserMenu((v) => !v)}>

          {/* แสดงอักษรย่อที่คำนวณไว้ใน avatarLetter */}
          <div className="admin-user-avatar">{avatarLetter}</div>

          <div>

            {/* แสดง username
                ถ้าไม่มีค่าที่ใช้ได้ ให้แสดงข้อความ 'ผู้ดูแลระบบ' แทน */}
            <p className="admin-user-name">{user?.username || 'ผู้ดูแลระบบ'}</p>

          </div>
        </div>

      {/* จบส่วนข้อมูลผู้ใช้ */}
      </div>

    {/* จบ sidebar */}
    </aside>

  ) // จบ JSX ที่คืนออกไป

} // จบ component AdminSidebar

// เปิดให้ไฟล์อื่น import AdminSidebar ไปใช้แบบ default
// เช่น AdminLayout.jsx นำไปแสดงด้วย <AdminSidebar />
export default AdminSidebar