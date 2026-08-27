import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import './AdminSidebar.css'

/* โลโก้อะตอมเดียวกับหน้าแชท ให้สอง section ของระบบดูเป็นชุดเดียวกัน */
const AtomIcon = ({ size = 18, color = '#0B1150' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.7">
    <ellipse cx="12" cy="12" rx="10" ry="4.2" />
    <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(60 12 12)" />
    <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(120 12 12)" />
    <circle cx="12" cy="12" r="1.8" fill={color} stroke="none" />
  </svg>
)

const LogoutIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

function AdminSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, setUser } = useAuth()

  const [showUserMenu, setShowUserMenu] = useState(false)

  const isActive = (path) => location.pathname === path

  const handleLogout = () => {
    setUser(null)
    navigate('/login')
  }

  const avatarLetter = user?.username ? user.username[0].toUpperCase() : 'A'

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-top">
        <div className="admin-brand-row">
          <div className="admin-brand-logo"><AtomIcon size={18} /></div>
          <div>
            <p className="admin-brand">Sci Assistant</p>
            <p className="admin-brand-sub">PSU - Admin Portal</p>
          </div>
        </div>

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
              to="/admin/mark-headings"
              className={isActive('/admin/mark-headings') ? 'admin-menu-item active' : 'admin-menu-item'}
            >
              ทำเครื่องหมายหัวข้อเอง
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

      <div className="admin-sidebar-user-wrap">
        {showUserMenu && (
          <div className="admin-user-menu">
            <button className="admin-user-menu-item" onClick={handleLogout}>
              <LogoutIcon /> ออกจากระบบ
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