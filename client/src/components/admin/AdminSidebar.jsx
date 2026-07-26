import { Link, useLocation } from 'react-router-dom'
import './AdminSidebar.css'

function AdminSidebar() {
  const location = useLocation()

  const isActive = (path) => location.pathname === path

  return (
    <aside className="admin-sidebar">
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
    </aside>
  )
}

export default AdminSidebar