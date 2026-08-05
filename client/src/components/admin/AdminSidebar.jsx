import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import './AdminSidebar.css'

function AdminSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, setUser } = useAuth()

  // state คุม dropdown เมนูผู้ใช้ล่าง sidebar (เปิด/ปิดเหมือนหน้า Chat.jsx)
  const [showUserMenu, setShowUserMenu] = useState(false)

  const isActive = (path) => location.pathname === path

  const handleLogout = () => {
    setUser(null)
    navigate('/login')
  }

  const avatarLetter = user?.username ? user.username[0].toUpperCase() : 'A'

  return (
    <aside className="admin-sidebar">
      {/* ครึ่งบน: โลโก้ + เมนูนำทาง (เนื้อหาเดิมทั้งหมด) */}
      <div className="admin-sidebar-top">
        <p className="admin-brand">Sci Assistant</p>
        <p className="admin-brand-sub">PSU - Admin Portal</p>

        <p className="sidebar-group-label">OVERVIEW</p>
        <ul className="admin-menu">
          <li>
            <Link
              to="/admin"
              className={isActive('/admin') ? 'admin-menu-item active' : 'admin-menu-item'}
            >
              ภาพรวมระบบ
            </Link>
          </li>
          <li>
            {/* ปุ่ม "กลับหน้าแชท" ย้ายมาไว้ใน sidebar แทนที่จะแปะซ้ำทุกหน้า
                เพื่อให้ตำแหน่งคงที่ทุกหน้า admin (UX: ตำแหน่งเดิมเสมอ หาเจอง่ายขึ้น) */}
            <Link to="/chat" className="admin-menu-item admin-menu-item-back">
              ← ไปหน้าแชท
            </Link>
          </li>
        </ul>

        <p className="sidebar-group-label">DOCUMENTS</p>
        <ul className="admin-menu">
          <li>
            <Link
              to="/admin/upload"
              className={isActive('/admin/upload') ? 'admin-menu-item active' : 'admin-menu-item'}
            >
              อัปโหลดเอกสาร
            </Link>
          </li>
          <li>
            <Link
              to="/admin/documents"
              className={isActive('/admin/documents') ? 'admin-menu-item active' : 'admin-menu-item'}
            >
              จัดการเอกสาร
            </Link>
          </li>
        </ul>
        <ul className="admin-menu">
          <li>
            <Link
              to="/admin/users"
              className={isActive('/admin/users') ? 'admin-menu-item active' : 'admin-menu-item'}
            >
              จัดการผู้ใช้งาน
            </Link>
          </li>
        </ul>
      </div>

      {/* ครึ่งล่าง: user + logout menu (โครงเดียวกับ Chat.jsx เพื่อความสม่ำเสมอทั้งระบบ) */}
      <div className="admin-sidebar-user-wrap">
        {showUserMenu && (
          <div className="admin-user-menu">
            <button className="admin-user-menu-item" onClick={handleLogout}>
              🚪 ออกจากระบบ
            </button>
          </div>
        )}

        <div className="admin-sidebar-user" onClick={() => setShowUserMenu((v) => !v)}>
          <div className="admin-user-avatar">{avatarLetter}</div>
          <div>
            <p className="admin-user-name">{user?.username || 'ผู้ดูแลระบบ'}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default AdminSidebar