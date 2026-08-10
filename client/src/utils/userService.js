import AppConfig from '../config/appConfig'

// header แนบ JWT token (pattern เดียวกับที่ UserManagement.jsx ใช้ แต่แยกออกมาให้หน้าอื่นเรียกซ้ำได้)
function authHeaders() {
  const token = localStorage.getItem('access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ดึงโปรไฟล์ของผู้ใช้ที่ login อยู่ (backend อ่าน user_id จาก JWT เอง ไม่ต้องส่งมา)
export async function getMyProfile() {
  const response = await fetch(`${AppConfig.apiBaseUri}/user/me`, {
    method: 'GET',
    headers: { ...authHeaders() },
  })
  const json = await response.json().catch(() => null)

  if (!response.ok) {
    return { isError: true, data: null, errorMessage: json?.detail || 'ไม่สามารถโหลดข้อมูลผู้ใช้ได้' }
  }
  return { isError: false, data: json, errorMessage: '' }
}

// อัปเดตชื่อ-นามสกุล-อีเมล
export async function updateMyProfile({ firstname, lastname, email }) {
  const response = await fetch(`${AppConfig.apiBaseUri}/user/me`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      ...authHeaders(),
    },
    body: JSON.stringify({
      firstname: firstname || null,
      lastname: lastname || null,
      email,
    }),
  })
  const json = await response.json().catch(() => null)

  if (!response.ok) {
    return { isError: true, data: null, errorMessage: json?.detail || 'บันทึกข้อมูลไม่สำเร็จ' }
  }
  return { isError: false, data: json, errorMessage: '' }
}

// เปลี่ยนรหัสผ่าน (ต้องส่งรหัสผ่านเดิมไปให้ backend ตรวจก่อนเสมอ)
export async function changeMyPassword({ currentPassword, newPassword }) {
  const response = await fetch(`${AppConfig.apiBaseUri}/user/me/password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      ...authHeaders(),
    },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  })
  const json = await response.json().catch(() => null)

  if (!response.ok) {
    return { isError: true, data: null, errorMessage: json?.detail || 'เปลี่ยนรหัสผ่านไม่สำเร็จ' }
  }
  return { isError: false, data: json, errorMessage: '' }
}