import { useState, useEffect, useMemo } from "react";
import "./UserManagement.css";
import AdminSidebar from '../../components/admin/AdminSidebar'

// ปรับ base URL ตาม config จริงของโปรเจกต์ (เช่นเดียวกับหน้าอื่นๆ ใน pages/admin)
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// role_id ในตาราง role ของ backend เป็น string (เช่น 'admin', 'staff', 'student')
// ปรับ mapping ตรงนี้ให้ตรงกับค่าจริงในตาราง role
const ROLE_LABELS = {
  admin: "ผู้ดูแลระบบ",
  staff: "เจ้าหน้าที่",
  student: "นักศึกษา",
};

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    setError(null);
    try {
      // หมายเหตุ: ตอนนี้ backend ยังไม่มี endpoint นี้ (มีแค่ /api/authen/register)
      // ต้องเพิ่ม GET /api/admin/users ฝั่ง server ก่อน หน้านี้ถึงจะดึงข้อมูลจริงได้
      const res = await fetch(`${API_BASE}/api/admin/users`);
      if (!res.ok) throw new Error("โหลดข้อมูลผู้ใช้ไม่สำเร็จ");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // filter ฝั่ง client จาก username/ชื่อ-นามสกุล ตามช่องค้นหาในดีไซน์
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      `${u.firstname ?? ""} ${u.lastname ?? ""} ${u.username}`
        .toLowerCase()
        .includes(q)
    );
  }, [users, search]);

  async function handleRoleChange(userId, newRoleId) {
    // optimistic update ให้ UI ตอบสนองทันที แล้วค่อย sync กับ backend
    // ถ้า request fail จะ rollback ด้วยการ fetch ใหม่ทั้งชุด (ดู catch ด้านล่าง)
    setUsers((prev) =>
      prev.map((u) => (u.user_id === userId ? { ...u, role_id: newRoleId } : u))
    );
    setOpenMenuId(null);

    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_id: newRoleId }),
      });
      if (!res.ok) throw new Error("อัปเดตบทบาทไม่สำเร็จ");
    } catch (err) {
      setError(err.message);
      fetchUsers();
    }
  }

  async function handleDelete(userId, displayName) {
    const confirmed = window.confirm(`ยืนยันการลบผู้ใช้ "${displayName}" ?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("ลบผู้ใช้ไม่สำเร็จ");
      setUsers((prev) => prev.filter((u) => u.user_id !== userId));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="admin-page">
      <AdminSidebar />

      <main className="admin-main">
        <div className="admin-content">
          <div className="um-page">
            <div className="um-header">
              <div>
                <h1 className="um-title">จัดการผู้ใช้งาน</h1>
                <p className="um-subtitle">จัดการบัญชีผู้ใช้และสิทธิ์การเข้าถึง</p>
              </div>
            </div>

            <div className="um-toolbar">
              <div className="um-search">
                <svg className="um-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  placeholder="ค้นหาชื่อหรือรหัสนักศึกษา..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button className="um-btn-add" onClick={() => alert("TODO: เปิดฟอร์มเพิ่มผู้ใช้")}>
                + เพิ่มผู้ใช้
              </button>
            </div>

            {error && <div className="um-error">{error}</div>}

            <div className="um-table-wrap">
              <table className="um-table">
                <thead>
                  <tr>
                    <th>ชื่อ-นามสกุล</th>
                    <th>บัญชีผู้ใช้งาน</th>
                    <th>บทบาท</th>
                    <th className="um-col-actions">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="um-empty">กำลังโหลดข้อมูล...</td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="um-empty">ไม่พบผู้ใช้ที่ค้นหา</td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.user_id}>
                        <td>{u.firstname} {u.lastname}</td>
                        <td className="um-email">{u.username}</td>
                        <td>
                          <span className={`um-role-badge um-role-${u.role_id}`}>
                            {ROLE_LABELS[u.role_id] ?? u.role_id}
                          </span>
                        </td>
                        <td className="um-col-actions">
                          <div className="um-actions-menu">
                            <button
                              className="um-btn-edit"
                              onClick={() =>
                                setOpenMenuId(openMenuId === u.user_id ? null : u.user_id)
                              }
                            >
                              แก้ไข ▾
                            </button>
                            {openMenuId === u.user_id && (
                              <div className="um-dropdown">
                                <div className="um-dropdown-label">เปลี่ยนบทบาทเป็น</div>
                                {Object.entries(ROLE_LABELS).map(([roleId, label]) => (
                                  <button
                                    key={roleId}
                                    className="um-dropdown-item"
                                    disabled={roleId === u.role_id}
                                    onClick={() => handleRoleChange(u.user_id, roleId)}
                                  >
                                    {label}
                                  </button>
                                ))}
                                <button
                                  className="um-dropdown-item um-dropdown-danger"
                                  onClick={() =>
                                    handleDelete(u.user_id, `${u.firstname} ${u.lastname}`)
                                  }
                                >
                                  ลบผู้ใช้
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}