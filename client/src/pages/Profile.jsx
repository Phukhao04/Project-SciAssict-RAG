// ============================================================
// ไฟล์: client/src/pages/Profile.jsx
//
// หน้าที่:
//   1) โหลดข้อมูลผู้ใช้มาแสดง
//   2) แก้ไขชื่อจริง นามสกุล และอีเมล
//   3) เปลี่ยนรหัสผ่าน
//   4) กลับไปหน้าแอดมินหรือหน้าแชทตามบทบาท
//
// ไฟล์ที่เกี่ยวข้อง:
//   userService.js = ส่งคำขอไป backend
//   AuthContext.jsx = เก็บข้อมูลผู้ใช้ที่ส่วนอื่นใช้ร่วมกัน
//   Profile.css = จัดหน้าตาหน้านี้
//
// แนวคิดสำคัญ:
//   พิมพ์ในช่อง → เปลี่ยน state ในหน้านี้ก่อน
//   กดบันทึก → ส่งค่า state ไป backend
//   สำเร็จ → แสดงข้อความและอัปเดตข้อมูลที่เกี่ยวข้อง
//
// การพิมพ์อย่างเดียวจึงยังไม่ได้บันทึกลง backend
// ============================================================

// useState = เก็บค่าที่เปลี่ยนแล้วทำให้หน้าจออัปเดต
// useEffect = ใช้เริ่มโหลดข้อมูลหลัง component แสดง
import { useState, useEffect } from 'react'

// ใช้รับฟังก์ชันสำหรับเปลี่ยนหน้า
import { useNavigate } from 'react-router-dom'

// อ่านและแก้ข้อมูลผู้ใช้ใน AuthContext
import { useAuth } from '../hooks/useAuth'

// ฟังก์ชันติดต่อ backend ที่อธิบายไปใน userService.js
// getMyProfile = อ่านข้อมูลส่วนตัว
// updateMyProfile = บันทึกข้อมูลส่วนตัว
// changeMyPassword = เปลี่ยนรหัสผ่าน
import { getMyProfile, updateMyProfile, changeMyPassword } from '../utils/userService'

// โหลด CSS ของหน้านี้
import './Profile.css'

// สร้าง component หน้าข้อมูลผู้ใช้
function Profile() {

  // user = ข้อมูลผู้ใช้ที่เก็บใน context
  // setUser = ฟังก์ชันอัปเดตข้อมูลนั้น
  const { user, setUser } = useAuth()

  // รับฟังก์ชันเปลี่ยนหน้า
  const navigate = useNavigate()

  // ==========================================================
  // ช่วงที่ 1: ข้อมูลและสถานะของแต่ละฟอร์ม
  // ==========================================================

  // ฟอร์มข้อมูลส่วนตัว

  // เก็บชื่อบัญชีที่โหลดมา แสดงให้อ่านแต่แก้ไม่ได้ในฟอร์มนี้
  const [username, setUsername] = useState('')

  // เก็บชื่อบทบาท เช่น ข้อความชื่อบทบาทที่ backend ส่งมา
  const [roleName, setRoleName] = useState('')

  // เก็บชื่อจริงที่แสดงในช่องกรอก
  const [firstname, setFirstname] = useState('')

  // เก็บนามสกุลที่แสดงในช่องกรอก
  const [lastname, setLastname] = useState('')

  // เก็บอีเมลที่แสดงในช่องกรอก
  const [email, setEmail] = useState('')

  // เริ่มต้น true เพราะเมื่อเข้าหน้าจะต้องโหลดข้อมูลก่อน
  const [isLoading, setIsLoading] = useState(true)

  // true เมื่อกำลังรอผลบันทึกข้อมูลส่วนตัว
  const [isSaving, setIsSaving] = useState(false)

  // ข้อความผิดพลาดของการโหลดหรือบันทึกข้อมูลส่วนตัว
  const [profileError, setProfileError] = useState('')

  // ข้อความสำเร็จของการบันทึกข้อมูลส่วนตัว
  const [profileSuccess, setProfileSuccess] = useState('')

  // ฟอร์มเปลี่ยนรหัสผ่าน แยก state กันเพราะเป็นคนละ action / คนละ error กับข้อมูลส่วนตัว

  // เก็บรหัสผ่านปัจจุบันที่ผู้ใช้กรอก
  const [currentPassword, setCurrentPassword] = useState('')

  // เก็บรหัสผ่านใหม่ที่ต้องการใช้
  const [newPassword, setNewPassword] = useState('')

  // เก็บรหัสผ่านใหม่ที่กรอกซ้ำเพื่อตรวจว่าตรงกัน
  const [confirmPassword, setConfirmPassword] = useState('')

  // true เมื่อกำลังรอผลเปลี่ยนรหัสผ่าน
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // ข้อความผิดพลาดเฉพาะการเปลี่ยนรหัสผ่าน
  const [passwordError, setPasswordError] = useState('')

  // ข้อความสำเร็จเฉพาะการเปลี่ยนรหัสผ่าน
  const [passwordSuccess, setPasswordSuccess] = useState('')

  // ตรวจว่าเป็นแอดมินหรือไม่ เพื่อกำหนดปลายทางของปุ่มกลับ
  // ?. = ถ้า user เป็น null หรือ undefined จะไม่ error
  const isAdmin = user?.role_id === 'R01'

  // ถ้ามี username ใช้ตัวอักษรแรกเป็นรูปโปรไฟล์
  // toUpperCase() = เปลี่ยนเป็นตัวพิมพ์ใหญ่
  // ถ้าไม่มีชื่อ ใช้ 'U'
  const avatarLetter = user?.username ? user.username[0].toUpperCase() : 'U'

  // ==========================================================
  // ช่วงที่ 2: โหลดข้อมูลผู้ใช้เมื่อเข้าหน้า
  // ==========================================================

  // โหลดข้อมูลสดจาก backend ตอนเข้าหน้า (ไม่ใช้ของ AuthContext ตรงๆ เพราะไม่มี email เก็บไว้)
  useEffect(() => {

    // ตัวแปรบอกว่า effect ชุดนี้ยังใช้งานอยู่หรือไม่
    // ใช้ป้องกันนำผลโหลดมาอัปเดต state หลัง cleanup
    // let = ประกาศตัวแปรที่เปลี่ยนค่าได้
    let isMounted = true

    // สร้างฟังก์ชัน async ภายใน effect เพื่อใช้ await
    async function loadProfile() {

      // เปิดสถานะกำลังโหลด
      setIsLoading(true)

      // ติดต่อ backend ผ่าน userService แล้วรอผล
      const result = await getMyProfile()

      // ถ้า effect ถูก cleanup แล้ว ให้หยุด
      // เช่น ผู้ใช้ออกจากหน้านี้ก่อนคำขอเสร็จ
      if (!isMounted) return

      // ถ้า service แจ้งข้อผิดพลาด
      if (result.isError) {

        // เก็บข้อความผิดพลาดไว้แสดง
        setProfileError(result.errorMessage)

      } else {

        // ถ้าสำเร็จ เติมข้อมูลที่โหลดมาเข้า state แต่ละช่อง
        setUsername(result.data.username)
        setRoleName(result.data.role_name)

        // ถ้าชื่อจริงไม่มีค่าที่ใช้ได้ ให้ใช้ข้อความว่าง
        // เพื่อให้ช่องกรอกได้รับค่าเป็นข้อความ
        setFirstname(result.data.firstname || '')

        // นามสกุลใช้หลักเดียวกัน
        setLastname(result.data.lastname || '')

        // เก็บอีเมลจาก backend
        setEmail(result.data.email)

      }

      // ปิดสถานะกำลังโหลดหลังจัดการผลลัพธ์
      setIsLoading(false)

    } // จบ loadProfile

    // เรียกฟังก์ชันที่เพิ่งประกาศ เพื่อเริ่มโหลดข้อมูลจริง
    loadProfile()

    // คืนฟังก์ชัน cleanup ให้ React
    // เมื่อ cleanup ทำงาน ตั้ง isMounted เป็น false
    // ไม่ได้ยกเลิกคำขอ fetch แต่หยุดนำผลมาอัปเดต state
    return () => { isMounted = false }

  }, []) // [] = ไม่ติดตามค่าใดเพื่อเรียก effect ใหม่จากการเปลี่ยน state

  // ==========================================================
  // ช่วงที่ 3: บันทึกข้อมูลส่วนตัว
  // ==========================================================

  // ทำงานเมื่อส่งฟอร์มข้อมูลส่วนตัว
  // e = เหตุการณ์ส่งฟอร์ม
  const handleSaveProfile = async (e) => {

    // ป้องกันฟอร์มทำให้หน้าโหลดใหม่
    e.preventDefault()

    // ล้างข้อความผิดพลาดเก่า
    setProfileError('')

    // ล้างข้อความสำเร็จเก่า
    setProfileSuccess('')

    // trim() = ตัดช่องว่างต้นท้ายเพื่อใช้ตรวจ
    // ! = ถ้าได้ข้อความว่าง ให้ถือว่าไม่ได้กรอกอีเมล
    // การตรวจนี้ไม่ได้แก้ค่า email ที่เก็บใน state
    if (!email.trim()) {

      // แจ้งว่าต้องกรอกอีเมล
      setProfileError('กรุณากรอกอีเมล')

      // หยุด ไม่ส่งคำขอบันทึก
      return

    }

    // เปิดสถานะกำลังบันทึก เพื่อปิดปุ่มระหว่างรอ
    setIsSaving(true)

    // ส่งชื่อจริง นามสกุล และอีเมลไปให้ userService
    // { firstname, lastname, email } เป็นรูปแบบเขียนสั้น
    // เช่น firstname หมายถึง firstname: firstname
    const result = await updateMyProfile({ firstname, lastname, email })

    // ได้ผลตอบกลับแล้ว ปิดสถานะกำลังบันทึก
    setIsSaving(false)

    // ถ้า service แจ้งข้อผิดพลาด
    if (result.isError) {

      // เก็บข้อความผิดพลาด
      setProfileError(result.errorMessage)

      // หยุด ไม่แสดงผลสำเร็จและไม่อัปเดต context
      return

    }

    // แจ้งว่าบันทึกสำเร็จ
    setProfileSuccess('บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว')

    // อัปเดต AuthContext (จะ sync ลง localStorage อัตโนมัติผ่าน useEffect ใน AuthContext.jsx)
    // ไม่งั้นชื่อที่โชว์ใน sidebar จะยังเป็นชื่อเก่าจนกว่าจะ login ใหม่

    // prev = ข้อมูลผู้ใช้ก่อนหน้าใน context
    // => ({ ... }) = คืนออบเจ็กต์ใหม่จาก arrow function
    setUser((prev) => ({

      // คัดลอกข้อมูลเดิม เช่น user_id, username และ role_id
      ...prev,

      // เขียนทับชื่อจริงด้วยค่าที่ backend ส่งกลับหลังบันทึก
      firstname: result.data.firstname,

      // เขียนทับนามสกุลด้วยค่าจาก backend
      lastname: result.data.lastname,

    }))

  } // จบ handleSaveProfile

  // ==========================================================
  // ช่วงที่ 4: เปลี่ยนรหัสผ่าน
  // ==========================================================

  // ทำงานเมื่อส่งฟอร์มเปลี่ยนรหัสผ่าน
  const handleChangePassword = async (e) => {

    // ป้องกันหน้าโหลดใหม่
    e.preventDefault()

    // ล้างข้อผิดพลาดครั้งก่อน
    setPasswordError('')

    // ล้างข้อความสำเร็จครั้งก่อน
    setPasswordSuccess('')

    // ตรวจความยาวรหัสผ่านใหม่ก่อนส่ง
    if (newPassword.length < 8) {

      // ถ้าสั้นกว่า 8 ให้แจ้งข้อผิดพลาด
      setPasswordError('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร')

      // หยุด ไม่ส่งให้ backend
      return

    }

    // !== = ไม่เท่ากัน
    // ตรวจว่ารหัสผ่านใหม่กับช่องยืนยันตรงกันหรือไม่
    if (newPassword !== confirmPassword) {

      setPasswordError('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน')
      return

    }

    // เปิดสถานะกำลังเปลี่ยนรหัสผ่าน
    setIsChangingPassword(true)

    // ส่งรหัสผ่านปัจจุบันและรหัสผ่านใหม่ให้ service
    // ไม่ส่ง confirmPassword เพราะใช้ตรวจในหน้านี้แล้ว
    // backend เป็นผู้ตรวจว่ารหัสผ่านปัจจุบันถูกต้องหรือไม่
    const result = await changeMyPassword({ currentPassword, newPassword })

    // ปิดสถานะรอผล
    setIsChangingPassword(false)

    // ถ้า service แจ้งข้อผิดพลาด
    if (result.isError) {

      // แสดงข้อความจากผลลัพธ์
      setPasswordError(result.errorMessage)

      // หยุด โดยยังคงค่าที่กรอกในช่องรหัสผ่านไว้
      return

    }

    // แจ้งผลสำเร็จ
    setPasswordSuccess('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว')

    // สำเร็จแล้วล้างทั้งสามช่อง
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')

  } // จบ handleChangePassword

  // ==========================================================
  // ช่วงที่ 5: หน้าจอ JSX
  //
  // value = ค่าที่ช่องกรอกแสดงจาก state
  // onChange = เมื่อผู้ใช้พิมพ์ ให้เปลี่ยน state
  // onSubmit = เมื่อส่งฟอร์ม ให้เรียกฟังก์ชันที่กำหนด
  // className = คลาสที่ Profile.css ใช้จัดหน้าตา
  // ==========================================================

  return (
    // พื้นที่ครอบทั้งหน้า
    <div className="profile-page">

      {/* แถบด้านบน: ปุ่มกลับและชื่อหน้า */}
      <div className="profile-topbar">

        {/* ถ้าเป็นแอดมิน ไป /admin
            ถ้าไม่ใช่ ไป /chat
            ไม่ใช่การย้อนกลับตามประวัติเบราว์เซอร์ */}
        <button className="profile-back-btn" onClick={() => navigate(isAdmin ? '/admin' : '/chat')}>
          ← กลับ
        </button>

        <p className="profile-topbar-title">ข้อมูลผู้ใช้งาน</p>
      </div>

      {/* พื้นที่ข้อมูลผู้ใช้และสองฟอร์ม */}
      <div className="profile-content">

        {/* การ์ดสรุปชื่อและบทบาท */}
        <div className="profile-header-card">

          {/* รูปโปรไฟล์แบบอักษรย่อ */}
          <div className="profile-avatar">{avatarLetter}</div>

          <div>
            <p className="profile-header-name">

              {/* ถ้ามีชื่อจริงหรือนามสกุล ให้แสดงชื่อรวมกัน
                  `${...}` = แทรกค่าตัวแปรในข้อความ
                  trim() = ตัดช่องว่างต้นท้ายของชื่อที่รวมแล้ว
                  ถ้าไม่มีทั้งสองค่า ให้แสดง username
                  ใช้ค่าจาก state จึงเปลี่ยนตามการพิมพ์ได้ก่อนบันทึก */}
              {firstname || lastname ? `${firstname} ${lastname}`.trim() : username}

            </p>

            {/* แสดงชื่อบทบาทที่โหลดจาก backend */}
            <p className="profile-header-role">{roleName}</p>

          </div>
        </div>

        {/* ถ้ากำลังโหลด แสดงข้อความรอ
            ถ้าโหลดเสร็จ แสดงสองฟอร์ม */}
        {isLoading ? (
          <p className="profile-loading">กำลังโหลดข้อมูล...</p>
        ) : (

          // Fragment <>...</> รวมหลาย element โดยไม่สร้าง div เพิ่ม
          <>
            {/* ===== แก้ไขข้อมูลส่วนตัว ===== */}

            {/* ส่งฟอร์มนี้แล้วเรียก handleSaveProfile */}
            <form className="profile-card" onSubmit={handleSaveProfile}>
              <h2 className="profile-card-title">แก้ไขข้อมูลส่วนตัว</h2>

              <div className="profile-field">
                <label>ชื่อผู้ใช้งาน</label>

                {/* แก้ username ไม่ได้ เพราะผูกกับ challenge-response login (authen_request/access_request) */}

                {/* disabled = ปิดการแก้ไขช่องชื่อบัญชี */}
                <input type="text" value={username} disabled />

              </div>

              {/* กลุ่มชื่อจริงและนามสกุล ใช้ CSS จัดวางร่วมกัน */}
              <div className="profile-field-row">
                <div className="profile-field">
                  <label>ชื่อจริง</label>
                  <input

                    // ช่องข้อความทั่วไป
                    type="text"

                    // แสดงชื่อจริงจาก state
                    value={firstname}

                    // e.target.value = ข้อความล่าสุดในช่องกรอก
                    // เปลี่ยนเฉพาะ state ยังไม่บันทึก backend
                    onChange={(e) => setFirstname(e.target.value)}

                    // ข้อความตัวอย่างเมื่อช่องว่าง
                    placeholder="ชื่อจริง"

                  />
                </div>

                <div className="profile-field">
                  <label>นามสกุล</label>
                  <input
                    type="text"

                    // แสดงนามสกุลจาก state
                    value={lastname}

                    // อัปเดต state เมื่อพิมพ์
                    onChange={(e) => setLastname(e.target.value)}

                    placeholder="นามสกุล"
                  />
                </div>
              </div>

              <div className="profile-field">
                <label>อีเมล</label>
                <input

                  // ให้เบราว์เซอร์ตรวจรูปแบบอีเมลเบื้องต้น
                  type="email"
                  value={email}

                  // อัปเดตอีเมลใน state
                  onChange={(e) => setEmail(e.target.value)}

                  placeholder="อีเมล"

                  // บังคับมีค่าก่อนส่งฟอร์ม
                  required

                />
              </div>

              {/* แสดงเมื่อมีข้อความผิดพลาด
                  && = ถ้าด้านซ้ายมีค่าที่เป็นจริง จึงแสดงด้านขวา */}
              {profileError && <div className="profile-error">{profileError}</div>}

              {/* แสดงเมื่อมีข้อความบันทึกสำเร็จ */}
              {profileSuccess && <div className="profile-success">{profileSuccess}</div>}

              {/* submit = ส่งฟอร์มข้อมูลส่วนตัว
                  disabled ปิดปุ่มขณะกำลังรอผลบันทึก */}
              <button type="submit" className="profile-save-btn" disabled={isSaving}>

                {/* เปลี่ยนข้อความตามสถานะบันทึก */}
                {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}

              </button>
            </form>

            {/* ===== เปลี่ยนรหัสผ่าน ===== */}

            {/* เป็นอีกฟอร์มหนึ่ง ส่งแล้วเรียก handleChangePassword
                จึงไม่เรียก handleSaveProfile */}
            <form className="profile-card" onSubmit={handleChangePassword}>
              <h2 className="profile-card-title">เปลี่ยนรหัสผ่าน</h2>

              <div className="profile-field">
                <label>รหัสผ่านปัจจุบัน</label>
                <input

                  // ซ่อนตัวอักษรที่พิมพ์บนหน้าจอ
                  // ไม่ใช่การเข้ารหัสข้อมูลสำหรับส่งผ่านเครือข่าย
                  type="password"

                  // แสดงค่าจาก state รหัสผ่านปัจจุบัน
                  value={currentPassword}

                  // เก็บค่าที่กรอกลง state
                  onChange={(e) => setCurrentPassword(e.target.value)}

                  placeholder="รหัสผ่านปัจจุบัน"
                  required

                />
              </div>

              {/* กลุ่มรหัสผ่านใหม่และช่องยืนยัน */}
              <div className="profile-field-row">
                <div className="profile-field">
                  <label>รหัสผ่านใหม่</label>
                  <input
                    type="password"
                    value={newPassword}

                    // อัปเดตรหัสผ่านใหม่เมื่อพิมพ์
                    onChange={(e) => setNewPassword(e.target.value)}

                    // เป็นข้อความแนะนำ
                    // การตรวจความยาวจริงอยู่ใน handleChangePassword
                    placeholder="อย่างน้อย 8 ตัวอักษร"

                    required
                  />
                </div>

                <div className="profile-field">
                  <label>ยืนยันรหัสผ่านใหม่</label>
                  <input
                    type="password"
                    value={confirmPassword}

                    // เก็บรหัสผ่านที่พิมพ์ซ้ำเพื่อนำมาเปรียบเทียบ
                    onChange={(e) => setConfirmPassword(e.target.value)}

                    placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง"
                    required
                  />
                </div>
              </div>

              {/* ข้อผิดพลาดของฟอร์มรหัสผ่าน แยกจาก profileError */}
              {passwordError && <div className="profile-error">{passwordError}</div>}

              {/* ข้อความสำเร็จของฟอร์มรหัสผ่าน */}
              {passwordSuccess && <div className="profile-success">{passwordSuccess}</div>}

              {/* ปิดปุ่มนี้เฉพาะขณะกำลังเปลี่ยนรหัสผ่าน */}
              <button type="submit" className="profile-save-btn" disabled={isChangingPassword}>

                {/* ข้อความบนปุ่มเปลี่ยนตามสถานะ */}
                {isChangingPassword ? 'กำลังเปลี่ยนรหัสผ่าน...' : 'เปลี่ยนรหัสผ่าน'}

              </button>
            </form>

          {/* จบ Fragment ที่ครอบสองฟอร์ม */}
          </>
        )}

      {/* จบพื้นที่เนื้อหา */}
      </div>

    {/* จบหน้าข้อมูลผู้ใช้ */}
    </div>

  ) // จบ JSX
} // จบ component Profile

// เปิดให้ App.jsx import ไปแสดงที่เส้นทาง /profile
export default Profile