import { useState, useEffect, useMemo, useRef } from "react";
import "./UserManagement.css";
import AdminSidebar from '../../components/admin/AdminSidebar'

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// แก้จากเดิมที่อ่าน key "user_id" ตรงๆ (ไม่เคยมีการ set key นี้จริง)
// AuthContext.jsx เก็บ user ทั้งก้อนเป็น JSON ไว้ที่ key "user" เท่านั้น
// ของเดิมจะได้ null เสมอ ทำให้ isSelf เป็น false ตลอด (admin ลบ/เปลี่ยน role ตัวเองได้โดยไม่ถูกกัน)
function getCurrentUserId() {
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.user_id ?? null;
  } catch {
    return null;
  }
}

function authHeaders() {
  const token = localStorage.getItem("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// map role_id จริง (R01, R02, ...) ไปเป็น class สี badge
// แยกออกมาจาก role_id ตรงๆ เพราะ role_id ในอนาคตอาจเพิ่ม R03, R04
// โดยไม่ต้องมาคอยเดา CSS class ชื่อใหม่ทุกครั้ง ถ้า role ไหนไม่รู้จัก fallback เป็นสีเทากลาง
const ROLE_BADGE_CLASS = {
  R01: "um-role-admin",
  R02: "um-role-student",
};

// ดึง current user จาก token/localStorage ที่เก็บไว้ตอน login (authService.js เดิม)

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]); // [{role_id, role_name}, ...]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [updatingUserId, setUpdatingUserId] = useState(null); // กันกดซ้ำระหว่างรอผล

  const menuRef = useRef(null);
  const currentUserId = getCurrentUserId();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    fetchUsers();
    // eslint-disable-next-line react-hooks/immutability
    fetchRoles();
  }, []);

  // ปิด dropdown เมื่อคลิกนอกเมนู
  useEffect(() => {
    function handleClickOutside(e) {
      if (!e.target.closest(".um-actions-menu")) setOpenMenuId(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function fetchUsers() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        headers: { ...authHeaders() },
      });
      if (res.status === 401) throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
      if (res.status === 403) throw new Error("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
      if (!res.ok) throw new Error("โหลดข้อมูลผู้ใช้ไม่สำเร็จ");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchRoles() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/roles`, {
        headers: { ...authHeaders() },
      });
      if (!res.ok) throw new Error("โหลดข้อมูลบทบาทไม่สำเร็จ");
      const data = await res.json();
      setRoles(data);
    } catch (err) {
      setError(err.message);
    }
  }

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      `${u.firstname ?? ""} ${u.lastname ?? ""} ${u.username}`
        .toLowerCase()
        .includes(q)
    );
  }, [users, search]);

  async function handleRoleChange(userId, newRoleId, displayName) {
    setOpenMenuId(null);

    // การให้สิทธิ์ admin เป็นการกระทำที่มีผลกระทบสูง ต้อง confirm ชัดเจนก่อนเสมอ
    // แก้จาก newRoleId === "admin" เป็น "R01" ให้ตรงกับ role_id จริงใน DB
    if (newRoleId === "R01") {
      const confirmed = window.confirm(
        `ยืนยันให้สิทธิ์ "ผู้ดูแลระบบ" แก่ "${displayName}" ?\nผู้ใช้นี้จะสามารถจัดการผู้ใช้อื่นและข้อมูลทั้งระบบได้`
      );
      if (!confirmed) return;
    }

    setUpdatingUserId(userId);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ role_id: newRoleId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "อัปเดตบทบาทไม่สำเร็จ");
      }

      // pessimistic update: รอ backend ยืนยันก่อนค่อยอัปเดต UI เพราะเป็น action ที่กระทบสิทธิ์สูง
      const newRoleName = roles.find((r) => r.role_id === newRoleId)?.role_name ?? newRoleId;
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === userId
            ? { ...u, role_id: newRoleId, role_name: newRoleName }
            : u
        )
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function handleDelete(userId, displayName) {
    const confirmed = window.confirm(`ยืนยันการลบผู้ใช้ "${displayName}" ?`);
    if (!confirmed) return;

    setOpenMenuId(null);
    setUpdatingUserId(userId);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: { ...authHeaders() },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "ลบผู้ใช้ไม่สำเร็จ");
      }

      setUsers((prev) => prev.filter((u) => u.user_id !== userId));
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingUserId(null);
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
                  aria-label="ค้นหาผู้ใช้"
                  placeholder="ค้นหาชื่อ..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {/* ตัดปุ่ม "+ เพิ่มผู้ใช้" ออก: ระบบนี้ทุกคนสมัครเองเป็น role user เสมอ
                  admin มีหน้าที่แค่เลื่อนสิทธิ์ ไม่ใช่สร้างบัญชีใหม่ */}
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
                    filteredUsers.map((u) => {
                      const isSelf = u.user_id === currentUserId;
                      const isUpdating = updatingUserId === u.user_id;
                      // fallback "um-role-default" กันกรณี role_id ใหม่ในอนาคตที่ยังไม่ได้ทำสีไว้
                      const badgeClass = ROLE_BADGE_CLASS[u.role_id] ?? "um-role-default";

                      return (
                        <tr key={u.user_id}>
                          <td>{u.firstname} {u.lastname}</td>
                          <td className="um-email">{u.username}</td>
                          <td>
                            <span className={`um-role-badge ${badgeClass}`}>
                              {u.role_name}
                            </span>
                          </td>
                          <td className="um-col-actions">
                            <div className="um-actions-menu" ref={menuRef}>
                              <button
                                className="um-btn-edit"
                                aria-haspopup="true"
                                aria-expanded={openMenuId === u.user_id}
                                disabled={isUpdating}
                                onClick={() =>
                                  setOpenMenuId(openMenuId === u.user_id ? null : u.user_id)
                                }
                              >
                                {isUpdating ? "กำลังบันทึก..." : "แก้ไข ▾"}
                              </button>
                              {openMenuId === u.user_id && (
                                <div className="um-dropdown">
                                  {isSelf ? (
                                    <div className="um-dropdown-label">
                                      ไม่สามารถแก้ไขบัญชีตัวเองได้จากหน้านี้
                                    </div>
                                  ) : (
                                    <>
                                      <div className="um-dropdown-label">เปลี่ยนบทบาทเป็น</div>
                                      {roles.map((role) => (
                                        <button
                                          key={role.role_id}
                                          className="um-dropdown-item"
                                          disabled={role.role_id === u.role_id}
                                          onClick={() =>
                                            handleRoleChange(
                                              u.user_id,
                                              role.role_id,
                                              `${u.firstname} ${u.lastname}`
                                            )
                                          }
                                        >
                                          {role.role_name}
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
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
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