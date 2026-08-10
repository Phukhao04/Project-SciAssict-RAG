import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getMyProfile, updateMyProfile, changeMyPassword } from '../utils/userService'
import './Profile.css'

function Profile() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()

  // ฟอร์มข้อมูลส่วนตัว
  const [username, setUsername] = useState('')
  const [roleName, setRoleName] = useState('')
  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [email, setEmail] = useState('')

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')

  // ฟอร์มเปลี่ยนรหัสผ่าน แยก state กันเพราะเป็นคนละ action / คนละ error กับข้อมูลส่วนตัว
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  const isAdmin = user?.role_id === 'R01'
  const avatarLetter = user?.username ? user.username[0].toUpperCase() : 'U'

  // โหลดข้อมูลสดจาก backend ตอนเข้าหน้า (ไม่ใช้ของ AuthContext ตรงๆ เพราะไม่มี email เก็บไว้)
  useEffect(() => {
    let isMounted = true

    async function loadProfile() {
      setIsLoading(true)
      const result = await getMyProfile()
      if (!isMounted) return

      if (result.isError) {
        setProfileError(result.errorMessage)
      } else {
        setUsername(result.data.username)
        setRoleName(result.data.role_name)
        setFirstname(result.data.firstname || '')
        setLastname(result.data.lastname || '')
        setEmail(result.data.email)
      }
      setIsLoading(false)
    }

    loadProfile()
    return () => { isMounted = false }
  }, [])

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setProfileError('')
    setProfileSuccess('')

    if (!email.trim()) {
      setProfileError('กรุณากรอกอีเมล')
      return
    }

    setIsSaving(true)
    const result = await updateMyProfile({ firstname, lastname, email })
    setIsSaving(false)

    if (result.isError) {
      setProfileError(result.errorMessage)
      return
    }

    setProfileSuccess('บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว')

    // อัปเดต AuthContext (จะ sync ลง localStorage อัตโนมัติผ่าน useEffect ใน AuthContext.jsx)
    // ไม่งั้นชื่อที่โชว์ใน sidebar จะยังเป็นชื่อเก่าจนกว่าจะ login ใหม่
    setUser((prev) => ({
      ...prev,
      firstname: result.data.firstname,
      lastname: result.data.lastname,
    }))
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (newPassword.length < 8) {
      setPasswordError('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน')
      return
    }

    setIsChangingPassword(true)
    const result = await changeMyPassword({ currentPassword, newPassword })
    setIsChangingPassword(false)

    if (result.isError) {
      setPasswordError(result.errorMessage)
      return
    }

    setPasswordSuccess('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <div className="profile-page">
      <div className="profile-topbar">
        <button className="profile-back-btn" onClick={() => navigate(isAdmin ? '/admin' : '/chat')}>
          ← กลับ
        </button>
        <p className="profile-topbar-title">ข้อมูลผู้ใช้งาน</p>
      </div>

      <div className="profile-content">
        <div className="profile-header-card">
          <div className="profile-avatar">{avatarLetter}</div>
          <div>
            <p className="profile-header-name">
              {firstname || lastname ? `${firstname} ${lastname}`.trim() : username}
            </p>
            <p className="profile-header-role">{roleName}</p>
          </div>
        </div>

        {isLoading ? (
          <p className="profile-loading">กำลังโหลดข้อมูล...</p>
        ) : (
          <>
            {/* ===== แก้ไขข้อมูลส่วนตัว ===== */}
            <form className="profile-card" onSubmit={handleSaveProfile}>
              <h2 className="profile-card-title">แก้ไขข้อมูลส่วนตัว</h2>

              <div className="profile-field">
                <label>ชื่อผู้ใช้งาน</label>
                {/* แก้ username ไม่ได้ เพราะผูกกับ challenge-response login (authen_request/access_request) */}
                <input type="text" value={username} disabled />
              </div>

              <div className="profile-field-row">
                <div className="profile-field">
                  <label>ชื่อจริง</label>
                  <input
                    type="text"
                    value={firstname}
                    onChange={(e) => setFirstname(e.target.value)}
                    placeholder="ชื่อจริง"
                  />
                </div>
                <div className="profile-field">
                  <label>นามสกุล</label>
                  <input
                    type="text"
                    value={lastname}
                    onChange={(e) => setLastname(e.target.value)}
                    placeholder="นามสกุล"
                  />
                </div>
              </div>

              <div className="profile-field">
                <label>อีเมล</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="อีเมล"
                  required
                />
              </div>

              {profileError && <div className="profile-error">{profileError}</div>}
              {profileSuccess && <div className="profile-success">{profileSuccess}</div>}

              <button type="submit" className="profile-save-btn" disabled={isSaving}>
                {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
              </button>
            </form>

            {/* ===== เปลี่ยนรหัสผ่าน ===== */}
            <form className="profile-card" onSubmit={handleChangePassword}>
              <h2 className="profile-card-title">เปลี่ยนรหัสผ่าน</h2>

              <div className="profile-field">
                <label>รหัสผ่านปัจจุบัน</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="รหัสผ่านปัจจุบัน"
                  required
                />
              </div>

              <div className="profile-field-row">
                <div className="profile-field">
                  <label>รหัสผ่านใหม่</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="อย่างน้อย 8 ตัวอักษร"
                    required
                  />
                </div>
                <div className="profile-field">
                  <label>ยืนยันรหัสผ่านใหม่</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง"
                    required
                  />
                </div>
              </div>

              {passwordError && <div className="profile-error">{passwordError}</div>}
              {passwordSuccess && <div className="profile-success">{passwordSuccess}</div>}

              <button type="submit" className="profile-save-btn" disabled={isChangingPassword}>
                {isChangingPassword ? 'กำลังเปลี่ยนรหัสผ่าน...' : 'เปลี่ยนรหัสผ่าน'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default Profile