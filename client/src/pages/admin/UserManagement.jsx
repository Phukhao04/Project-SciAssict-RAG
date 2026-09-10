import { useState, useEffect, useMemo, useRef } from "react";
import { Search } from "lucide-react";
import AdminLayout from "../../components/admin/AdminLayout";
import AppConfig from "../../config/appConfig";
import { authHeaders } from "../../utils/authHeaders";
import "./UserManagement.css";

const API_BASE = AppConfig.apiBase;

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

const ROLE_BADGE_CLASS = {
  R01: "um-role-admin",
  R02: "um-role-student",
};

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]); // [{role_id, role_name}, ...]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [dropUp, setDropUp] = useState(false); // true = เปิดเมนูขึ้นด้านบน (กันโดนขอบล่างของพื้นที่สกรอลตัดขอบ)
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

  function toggleMenu(e, userId) {
    if (openMenuId === userId) {
      setOpenMenuId(null);
      return;
    }
    // ถ้าพื้นที่ด้านล่างปุ่มไม่พอสำหรับเมนู ให้เปิดขึ้นด้านบนแทน
    const rect = e.currentTarget.getBoundingClientRect();
    const estimatedDropdownHeight = 220;
    setDropUp(window.innerHeight - rect.bottom < estimatedDropdownHeight);
    setOpenMenuId(userId);
  }

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
    <AdminLayout>
      <div className="um-page">
            <div className="um-header">
              <div>
                <h1 className="um-title">จัดการผู้ใช้งาน</h1>
                <p className="um-subtitle">จัดการบัญชีผู้ใช้และสิทธิ์การเข้าถึง</p>
              </div>
            </div>

            <div className="um-toolbar">
              <div className="um-search">
                <Search className="um-search-icon" size={16} />
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
                                onClick={(e) => toggleMenu(e, u.user_id)}
                              >
                                {isUpdating ? "กำลังบันทึก..." : "แก้ไข ▾"}
                              </button>
                              {openMenuId === u.user_id && (
                                <div className={`um-dropdown${dropUp ? " um-dropdown-up" : ""}`}>
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
    </AdminLayout>
  );
}