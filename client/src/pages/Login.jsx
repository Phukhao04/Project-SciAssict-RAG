// ============================================================
// ไฟล์: client/src/pages/Login.jsx
//
// หน้าที่:
//   1) แสดงฟอร์มเข้าสู่ระบบและสมัครสมาชิก
//   2) เก็บข้อมูลที่ผู้ใช้กรอก
//   3) เรียก authService.js เพื่อติดต่อ backend
//   4) เก็บข้อมูลผู้ใช้เมื่อล็อกอินสำเร็จ แล้วเปลี่ยนหน้า
//
// ภาพรวมการล็อกอิน:
//   กรอก username และ password
//   → กดเข้าสู่ระบบ
//   → handleLoginSubmit ทำงาน
//   → authenRequest ขอ token ขั้นแรก
//   → accessRequest ใช้ token และข้อมูลรหัสผ่านยืนยันตัวตน
//   → setUser เก็บข้อมูลผู้ใช้
//   → navigate เปลี่ยนหน้า
//
// ภาพรวมการสมัคร:
//   กรอกข้อมูล
//   → ตรวจข้อมูลเบื้องต้น
//   → registerRequest ส่งข้อมูลให้ backend
//   → ถ้าสำเร็จ กลับมาแสดงฟอร์มเข้าสู่ระบบ
// ============================================================

// useState = เก็บค่าที่เปลี่ยนได้ เมื่อเปลี่ยนค่า React จะอัปเดตหน้าจอ
import { useState } from 'react'

// useNavigate = รับฟังก์ชันสำหรับสั่งเปลี่ยนหน้า
import { useNavigate } from 'react-router-dom'

// นำเข้าไอคอนจาก lucide-react
// Atom = อะตอม, Eye = ตา, EyeOff = ตาที่มีขีดปิด
import { Atom, Eye, EyeOff } from 'lucide-react'

// hook ของโปรเจกต์ ใช้เข้าถึงข้อมูลและฟังก์ชันใน AuthContext
import { useAuth } from '../hooks/useAuth'

// นำเข้าฟังก์ชันติดต่อ backend จาก authService.js
import {
  authenRequest, // ล็อกอินขั้นแรก: ขอ token ชั่วคราว
  accessRequest, // ล็อกอินขั้นที่สอง: ยืนยันตัวตน
  registerRequest, // ส่งข้อมูลสมัครสมาชิก
} from '../utils/authService'

// โหลด CSS สำหรับจัดหน้าตาหน้านี้
import './Login.css'

// role_id คงที่สำหรับ user ที่สมัครเอง
// ผู้ที่สมัครผ่านฟอร์มนี้จะถูกส่งบทบาท R02 ไปให้ backend
// การอนุญาตบทบาทจริงยังต้องตรวจสอบที่ backend ด้วย
const DEFAULT_ROLE_ID = 'R02'

// สร้าง component หน้าล็อกอิน
function Login() {

  // รับฟังก์ชัน navigate ไว้สั่งเปลี่ยนหน้า
  const navigate = useNavigate()

  // ดึง setUser จาก AuthContext เพื่อบันทึกผู้ใช้เมื่อล็อกอินสำเร็จ
  const { setUser } = useAuth()

  // mode = ตอนนี้แสดงฟอร์มไหน
  // เริ่มต้น 'login'; ถ้าเป็น 'register' จะแสดงฟอร์มสมัคร
  const [mode, setMode] = useState('login')

  // รูปแบบ useState:
  // [ค่าปัจจุบัน, ฟังก์ชันเปลี่ยนค่า] = useState(ค่าเริ่มต้น)

  // เก็บชื่อผู้ใช้ เริ่มต้นเป็นข้อความว่าง
  // ฟอร์มล็อกอินและสมัครใช้ state ตัวนี้ร่วมกัน
  const [username, setUsername] = useState('')

  // เก็บรหัสผ่านที่กรอก ทั้งสองฟอร์มใช้ตัวนี้ร่วมกัน
  const [password, setPassword] = useState('')

  // false = ซ่อนรหัสผ่าน, true = แสดงรหัสผ่าน
  const [showPassword, setShowPassword] = useState(false)

  // เก็บชื่อจริงสำหรับสมัครสมาชิก
  const [firstname, setFirstname] = useState('')

  // เก็บนามสกุลสำหรับสมัครสมาชิก
  const [lastname, setLastname] = useState('')

  // เก็บอีเมลสำหรับสมัครสมาชิก
  const [email, setEmail] = useState('')

  // เก็บค่าที่กรอกในช่องยืนยันรหัสผ่าน
  const [confirmPassword, setConfirmPassword] = useState('')

  // เก็บข้อความผิดพลาดของการล็อกอิน
  const [errorMessage, setErrorMessage] = useState('')

  // เก็บว่ากำลังรอผลล็อกอินอยู่หรือไม่
  const [isLoading, setIsLoading] = useState(false)

  // เก็บข้อผิดพลาดแยกตามช่องสมัคร
  // เช่น { email: 'รูปแบบอีเมลไม่ถูกต้อง' }
  const [registerFieldErrors, setRegisterFieldErrors] = useState({})

  // เก็บข้อผิดพลาดรวมของการสมัคร เช่น ติดต่อ server ไม่ได้
  const [registerGeneralError, setRegisterGeneralError] = useState('')

  // เก็บข้อความแจ้งว่าสมัครสำเร็จ
  const [registerSuccessMessage, setRegisterSuccessMessage] = useState('')

  // เก็บว่ากำลังรอผลสมัครอยู่หรือไม่
  const [isRegistering, setIsRegistering] = useState(false)

  // ==========================================================
  // ช่วงที่ 1: จัดการการล็อกอิน
  // ==========================================================

  // ฟังก์ชันนี้ถูกเรียกเมื่อส่งฟอร์มเข้าสู่ระบบ
  // e = event หรือข้อมูลเหตุการณ์ส่งฟอร์ม
  // async = ใช้ await รอผลจาก backend ได้
  const handleLoginSubmit = async (e) => {

    // ป้องกันพฤติกรรมปกติของฟอร์มที่อาจทำให้หน้าโหลดใหม่
    e.preventDefault()

    // ล้างข้อความผิดพลาดเก่าก่อนลองล็อกอินใหม่
    setErrorMessage('')

    // เปิดสถานะกำลังล็อกอิน เพื่อปิดปุ่มและเปลี่ยนข้อความบนปุ่ม
    setIsLoading(true)

    // try = ลองทำคำสั่งข้างใน
    // ถ้ามี exception จะกระโดดไป catch
    try {

      // ส่ง username ไปขอ token ขั้นแรก แล้วรอผล
      // step1 เป็นผลลัพธ์จาก authenRequest ใน authService.js
      const step1 = await authenRequest(username)

      // ถ้า backend แจ้งว่าขั้นแรกผิดพลาด
      if (step1.isError) {

        // เก็บข้อความเพื่อให้หน้าจอแสดง
        setErrorMessage(step1.errorMessage)

        // หยุดฟังก์ชัน ไม่ทำล็อกอินขั้นที่สอง
        // แต่ finally ด้านล่างยังทำงาน
        return
      }

      // เก็บ token ชั่วคราวที่ได้จากขั้นแรก
      const authenToken = step1.data

      // เรียกล็อกอินขั้นที่สอง แล้วรอผล
      // authService.js จะนำข้อมูลเหล่านี้ไปคำนวณค่าที่ส่งให้ backend
      const step2 = await accessRequest(
        username, // ชื่อผู้ใช้
        password, // รหัสผ่านที่กรอก
        authenToken // token ชั่วคราวจากขั้นแรก
      )

      // ถ้าขั้นที่สองไม่ผ่าน
      if (step2.isError) {

        // เก็บข้อความผิดพลาดจากขั้นที่สอง
        setErrorMessage(step2.errorMessage)

        // หยุดการล็อกอิน โดย finally ยังทำงาน
        return
      }

      // ล็อกอินผ่านแล้ว สร้างออบเจ็กต์ข้อมูลผู้ใช้
      // เลือกข้อมูลจากคำตอบ backend มาเก็บใน AuthContext
      const user = {
        user_id: step2.data.user_id, // รหัสผู้ใช้
        username: step2.data.username, // ชื่อบัญชี
        firstname: step2.data.firstname, // ชื่อจริง
        lastname: step2.data.lastname, // นามสกุล
        role_id: step2.data.role_id, // รหัสบทบาท
      }

      // บันทึกข้อมูลผู้ใช้ลง AuthContext
      // component อื่นที่ใช้ context นี้จะเข้าถึงข้อมูลได้
      setUser(user)

      // ตรวจบทบาทเพื่อเลือกหน้าที่จะไปหลังล็อกอิน
      // === = เปรียบเทียบทั้งค่าและชนิดข้อมูล
      if (user.role_id === 'R01') {

        // R01 ไปหน้าภาพรวมแอดมิน
        navigate('/admin')

      } else {

        // บทบาทอื่นไปเส้นทาง /
        // App.jsx กำหนดให้เส้นทางนี้แสดง RootRedirect
        navigate('/')

      }

    } catch (err) {

      // จัดการ exception เช่น fetch ติดต่อ server ไม่ได้
      // err = ข้อมูลข้อผิดพลาดที่เกิดขึ้น

      // พิมพ์รายละเอียดใน Console เพื่อช่วยตรวจปัญหา
      console.error(err)

      // เก็บข้อความให้ผู้ใช้เห็นบนหน้าจอ
      setErrorMessage('เกิดข้อผิดพลาดในการเชื่อมต่อ server')

    } finally {

      // ทำหลัง try/catch แม้มี return ภายใน try
      // ปิดสถานะกำลังล็อกอิน เพื่อให้ปุ่มกลับมาใช้งานได้
      setIsLoading(false)

    }
  } // จบ handleLoginSubmit

  // ==========================================================
  // ช่วงที่ 2: ตรวจข้อมูลสมัครก่อนส่งให้ backend
  // ==========================================================

  // Client-side = ตรวจที่เบราว์เซอร์ของผู้ใช้
  // backend ยังต้องตรวจข้อมูลอีกครั้งด้วย
  const validateRegisterClientSide = () => {

    // เตรียมออบเจ็กต์ว่างไว้เก็บข้อผิดพลาดแต่ละช่อง
    const errors = {}

    // trim() = ตัดช่องว่างต้นและท้ายข้อความ
    // length = จำนวนหน่วยความยาวของข้อความ
    // || = หรือ: ถ้าสั้นกว่า 3 หรือยาวกว่า 50 ให้ถือว่าไม่ผ่าน
    //
    // trim() ในเงื่อนไขนี้ไม่ได้เปลี่ยนค่า username ใน state
    if (username.trim().length < 3 || username.trim().length > 50) {

      // เพิ่มข้อผิดพลาดช่อง username ลงออบเจ็กต์ errors
      errors.username = 'ชื่อผู้ใช้ต้องมีความยาว 3-50 ตัวอักษร'

    }

    // รหัสผ่านต้องมีความยาวอย่างน้อย 8
    if (password.length < 8) {
      errors.password = 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'
    }

    // !== = ไม่เท่ากัน
    // ตรวจว่ารหัสผ่านกับช่องยืนยันตรงกันหรือไม่
    if (password !== confirmPassword) {
      errors.confirmPassword = 'รหัสผ่านไม่ตรงกัน'
    }

    // Regular Expression หรือ regex = รูปแบบสำหรับตรวจข้อความ
    // ^ = เริ่มข้อความ, $ = จบข้อความ
    // [^\s@]+ = มีอย่างน้อยหนึ่งตัวที่ไม่ใช่ช่องว่างหรือ @
    // @ = ต้องมีเครื่องหมาย @
    // \. = ต้องมีจุด
    // ตรวจรูปแบบอีเมลเบื้องต้น ไม่ได้ตรวจว่าอีเมลนั้นมีอยู่จริง
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    // test(email) = ตรวจว่า email ตรงกับรูปแบบหรือไม่
    // ! = กลับค่า ดังนั้นเงื่อนไขนี้คือ "อีเมลไม่ผ่าน"
    if (!emailPattern.test(email)) {
      errors.email = 'รูปแบบอีเมลไม่ถูกต้อง'
    }

    // ส่งข้อผิดพลาดทั้งหมดเข้า state เพื่อแสดงใต้ช่องกรอก
    // ถ้าไม่มีข้อผิดพลาด จะตั้งเป็น {} และล้างข้อผิดพลาดเก่า
    setRegisterFieldErrors(errors)

    // Object.keys(errors) = รายการชื่อช่องใน errors
    // ถ้าจำนวนช่องเป็น 0 แสดงว่าไม่มีข้อผิดพลาด
    // คืน true เมื่อผ่าน และ false เมื่อไม่ผ่าน
    return Object.keys(errors).length === 0

  } // จบ validateRegisterClientSide

  // ==========================================================
  // ช่วงที่ 3: ส่งข้อมูลสมัครสมาชิก
  // ==========================================================

  // ถูกเรียกเมื่อส่งฟอร์มสมัครสมาชิก
  const handleRegisterSubmit = async (e) => {

    // ป้องกันฟอร์มทำให้หน้าโหลดใหม่
    e.preventDefault()

    // ล้างข้อผิดพลาดรวมจากการสมัครครั้งก่อน
    setRegisterGeneralError('')

    // ล้างข้อความสำเร็จจากครั้งก่อน
    setRegisterSuccessMessage('')

    // เรียกตรวจข้อมูล
    // ถ้าคืน false จะหยุด ไม่ส่งคำขอสมัคร
    if (!validateRegisterClientSide()) {
      return
    }

    // เปิดสถานะกำลังสมัคร เพื่อปิดปุ่มระหว่างรอ
    setIsRegistering(true)

    try {

      // ส่งออบเจ็กต์ข้อมูลไปให้ registerRequest แล้วรอผล
      const result = await registerRequest({

        // ตัดช่องว่างต้นท้ายชื่อบัญชีก่อนส่ง
        username: username.trim(),

        // เขียนสั้นแทน password: password
        // ส่งรหัสผ่านโดยไม่ตัดช่องว่าง
        password,

        // ตัดช่องว่างต้นท้ายอีเมลก่อนส่ง
        email: email.trim(),

        // ส่งบทบาทเริ่มต้น R02 สำหรับผู้สมัครผ่านฟอร์มนี้
        roleId: DEFAULT_ROLE_ID,

        // ส่งชื่อจริงหลังตัดช่องว่างต้นท้าย
        firstname: firstname.trim(),

        // ส่งนามสกุลหลังตัดช่องว่างต้นท้าย
        lastname: lastname.trim(),

      })

      // !result.isError = ผลสมัครไม่มีข้อผิดพลาด
      if (!result.isError) {

        // เตรียมข้อความสำเร็จ ซึ่งจะแสดงในฟอร์มล็อกอิน
        setRegisterSuccessMessage(
          'สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ'
        )

        // ล้างรหัสผ่าน
        setPassword('')

        // ล้างช่องยืนยันรหัสผ่าน
        setConfirmPassword('')

        // เปลี่ยนหน้าจอจากฟอร์มสมัครเป็นฟอร์มล็อกอิน
        // เป็นการเปลี่ยน state ไม่ใช่เปลี่ยน URL
        setMode('login')

        // จบฟังก์ชัน โดย finally ยังทำงาน
        return
      }

      // ถ้าผลสมัครมีข้อผิดพลาดแยกตามช่องจาก authService
      if (result.fieldErrors) {

        // เก็บข้อผิดพลาดเหล่านั้นเพื่อให้หน้าจอแสดง
        setRegisterFieldErrors(result.fieldErrors)

      } else {

        // ถ้าไม่มี fieldErrors โค้ดเดิมจะนำข้อความรวม
        // ไปใส่เป็นข้อผิดพลาดใต้ช่อง username
        setRegisterFieldErrors({
          username: result.errorMessage,
        })

      }

    } catch (err) {

      // ถ้ามี exception ระหว่างสมัคร ให้พิมพ์รายละเอียดใน Console
      console.error(err)

      // เก็บข้อความผิดพลาดรวมที่จะแสดงด้านบนฟอร์มสมัคร
      setRegisterGeneralError(
        'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง'
      )

    } finally {

      // ปิดสถานะกำลังสมัคร ทั้งกรณีสำเร็จและผิดพลาด
      setIsRegistering(false)

    }
  } // จบ handleRegisterSubmit

  // ==========================================================
  // ช่วงที่ 4: หน้าจอ JSX
  //
  // className = ชื่อคลาสที่ Login.css ใช้จัดหน้าตา
  // { ... } = ใส่ค่า/นิพจน์ JavaScript ลงใน JSX
  // เงื่อนไข && (...) = แสดงเนื้อหาเมื่อเงื่อนไขเป็นจริง
  // ==========================================================

  return (
    // พื้นที่ครอบทั้งหน้า
    <div className="login-page">

      {/* กล่องหลักที่ครอบโลโก้ แท็บ และฟอร์ม */}
      <div className="login-card">

        {/* แสดงไอคอนอะตอม ขนาด 24 และสีที่กำหนด */}
        <div className="login-logo"><Atom size={24} color="#0B1150" /></div>

        {/* ชื่อระบบ */}
        <h1 className="login-title">Sci Assistant</h1>

        {/* ข้อความรองใต้ชื่อระบบ */}
        <p className="login-subtitle">คณะวิทยาศาสตร์ ม.อ. หาดใหญ่</p>

        {/* กลุ่มปุ่มเลือกฟอร์ม */}
        <div className="login-tabs">

          {/* ปุ่มเลือกเข้าสู่ระบบ */}
          <button

            // ปุ่มทั่วไป ไม่ส่งฟอร์ม
            type="button"

            // ถ้า mode เป็น login ให้เพิ่มคลาส active
            // รูปแบบ เงื่อนไข ? ค่าถ้าจริง : ค่าถ้าเท็จ
            className={mode === 'login' ? 'tab active' : 'tab'}

            // เมื่อคลิก เปลี่ยน state เพื่อแสดงฟอร์มล็อกอิน
            onClick={() => setMode('login')}

          >
            เข้าสู่ระบบ
          </button>

          {/* ปุ่มเลือกสมัครสมาชิก */}
          <button
            type="button"

            // เพิ่ม active เมื่อกำลังแสดงฟอร์มสมัคร
            className={mode === 'register' ? 'tab active' : 'tab'}

            // เมื่อคลิก เปลี่ยนไปแสดงฟอร์มสมัคร
            onClick={() => setMode('register')}

          >
            สมัครใช้งาน
          </button>

        </div>

        {/* แสดงฟอร์มนี้เฉพาะเมื่อ mode เป็น login */}
        {mode === 'login' && (
          <form

            // เมื่อส่งฟอร์ม ให้เรียก handleLoginSubmit
            onSubmit={handleLoginSubmit}

            // คลาสสำหรับจัดหน้าตาฟอร์ม
            className="login-form"

          >

            {/* แสดงข้อความสมัครสำเร็จเมื่อมีข้อความใน state */}
            {registerSuccessMessage && (
              <p className="success-text">
                {registerSuccessMessage}
              </p>
            )}

            {/* ข้อความหัวช่องชื่อผู้ใช้ */}
            <label className="field-label">Username</label>

            {/* ช่องชื่อผู้ใช้
                value กับ onChange ทำให้ state เป็นตัวควบคุมค่าช่องกรอก */}
            <input

              // ช่องข้อความทั่วไป
              type="text"

              // แสดงค่าปัจจุบันจาก state username
              value={username}

              // เมื่อพิมพ์ รับข้อความใหม่จากช่องแล้วบันทึกลง state
              // e.target = ช่องกรอกที่เกิดเหตุการณ์
              // e.target.value = ค่าปัจจุบันในช่องนั้น
              onChange={(e) => setUsername(e.target.value)}

            />

            <label className="field-label">รหัสผ่าน</label>

            {/* ครอบช่องรหัสผ่านและปุ่มรูปตาไว้ด้วยกัน */}
            <div className="password-wrapper">
              <input

                // true = แสดงเป็นข้อความ, false = ซ่อนแบบช่องรหัสผ่าน
                type={showPassword ? 'text' : 'password'}

                // แสดงค่าจาก state password
                value={password}

                // บันทึกข้อความที่พิมพ์ลง state password
                onChange={(e) =>
                  setPassword(e.target.value)
                }

              />

              {/* ปุ่มสลับแสดงหรือซ่อนรหัสผ่าน */}
              <button

                // ป้องกันปุ่มรูปตาส่งฟอร์ม
                type="button"
                className="toggle-password"

                // v = ค่า showPassword ก่อนหน้า
                // !v = เปลี่ยนเป็นค่าตรงข้าม
                onClick={() =>
                  setShowPassword((v) => !v)
                }

              >

                {/* ถ้ากำลังแสดงรหัสผ่าน ใช้ไอคอน EyeOff
                    ถ้ากำลังซ่อน ใช้ไอคอน Eye */}
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}

              </button>
            </div>

            {/* แสดงข้อผิดพลาดล็อกอินเมื่อมีข้อความ */}
            {errorMessage && (
              <p className="error-message">
                {errorMessage}
              </p>
            )}

            {/* ปุ่มส่งฟอร์มล็อกอิน */}
            <button

              // submit = ส่งฟอร์ม ทำให้ onSubmit ของ form ทำงาน
              type="submit"
              className="submit-btn"

              // ระหว่างรอผล ปิดปุ่มเพื่อไม่ให้คลิกซ้ำ
              disabled={isLoading}

            >

              {/* เปลี่ยนข้อความตามสถานะรอผล */}
              {isLoading
                ? 'กำลังเข้าสู่ระบบ...'
                : 'เข้าสู่ระบบ'}

            </button>
          </form>
        )}

        {/* แสดงฟอร์มนี้เฉพาะเมื่อ mode เป็น register */}
        {mode === 'register' && (
          <form

            // ส่งฟอร์มแล้วเรียกฟังก์ชันสมัครสมาชิก
            onSubmit={handleRegisterSubmit}
            className="login-form"

          >

            {/* แสดงข้อผิดพลาดรวมของการสมัคร */}
            {registerGeneralError && (
              <p className="error-text">
                {registerGeneralError}
              </p>
            )}

            <label className="field-label">ชื่อ</label>

            {/* ช่องชื่อจริง ไม่ได้กำหนด required ในโค้ดนี้ */}
            <input
              type="text"

              // แสดงชื่อจริงจาก state
              value={firstname}

              // พิมพ์แล้วอัปเดตชื่อจริงใน state
              onChange={(e) =>
                setFirstname(e.target.value)
              }

            />

            <label className="field-label">นามสกุล</label>

            {/* ช่องนามสกุล ไม่ได้กำหนด required ในโค้ดนี้ */}
            <input
              type="text"
              value={lastname}

              // พิมพ์แล้วอัปเดตนามสกุล
              onChange={(e) =>
                setLastname(e.target.value)
              }

            />

            <label className="field-label">
              ชื่อผู้ใช้งาน
            </label>

            {/* ช่องชื่อบัญชีสำหรับสมัคร */}
            <input
              type="text"

              // ใช้ username ตัวเดียวกับฟอร์มล็อกอิน
              value={username}

              // บันทึกชื่อบัญชีที่พิมพ์
              onChange={(e) =>
                setUsername(e.target.value)
              }

              // เบราว์เซอร์ตรวจว่าต้องมีค่าก่อนส่งฟอร์ม
              required

            />

            {/* แสดงข้อผิดพลาดใต้ช่อง username เมื่อมีค่า */}
            {registerFieldErrors.username && (
              <p className="error-text">
                {registerFieldErrors.username}
              </p>
            )}

            <label className="field-label">อีเมล</label>

            <input

              // ให้เบราว์เซอร์ตรวจรูปแบบอีเมลเบื้องต้นด้วย
              type="email"
              value={email}

              // บันทึกอีเมลที่กรอก
              onChange={(e) =>
                setEmail(e.target.value)
              }

              // บังคับกรอกอีเมล
              required

            />

            {/* แสดงข้อผิดพลาดของช่องอีเมล */}
            {registerFieldErrors.email && (
              <p className="error-text">
                {registerFieldErrors.email}
              </p>
            )}

            <label className="field-label">รหัสผ่าน</label>

            {/* ครอบช่องรหัสผ่านและปุ่มรูปตา */}
            <div className="password-wrapper">
              <input

                // ใช้ showPassword ตัวเดียวกับฟอร์มล็อกอิน
                type={showPassword ? 'text' : 'password'}
                value={password}

                // บันทึกรหัสผ่านที่กรอก
                onChange={(e) =>
                  setPassword(e.target.value)
                }

                // บังคับกรอก
                required

                // เบราว์เซอร์ตรวจความยาวขั้นต่ำ 8 ก่อนส่งฟอร์ม
                // ยังมีการตรวจซ้ำใน validateRegisterClientSide
                minLength={8}

              />

              {/* ปุ่มแสดงหรือซ่อนรหัสผ่าน */}
              <button
                type="button"
                className="toggle-password"

                // สลับสถานะจากค่าก่อนหน้า
                onClick={() =>
                  setShowPassword((v) => !v)
                }

              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* แสดงข้อผิดพลาดของช่องรหัสผ่าน */}
            {registerFieldErrors.password && (
              <p className="error-text">
                {registerFieldErrors.password}
              </p>
            )}

            <label className="field-label">
              ยืนยันรหัสผ่าน
            </label>

            {/* ช่องพิมพ์รหัสผ่านอีกครั้งเพื่อตรวจว่าตรงกัน */}
            <input

              // ใช้ showPassword ร่วมกันกับช่องรหัสผ่านด้านบน
              // กดรูปตาจึงมีผลกับทั้งสองช่อง
              type={showPassword ? 'text' : 'password'}

              // แสดงค่าจาก state confirmPassword
              value={confirmPassword}

              // บันทึกค่าที่กรอกในช่องยืนยัน
              onChange={(e) =>
                setConfirmPassword(e.target.value)
              }

              // บังคับกรอก
              required

            />

            {/* แสดงข้อผิดพลาดเมื่อรหัสผ่านสองช่องไม่ตรงกัน */}
            {registerFieldErrors.confirmPassword && (
              <p className="error-text">
                {registerFieldErrors.confirmPassword}
              </p>
            )}

            {/* ปุ่มส่งฟอร์มสมัคร */}
            <button
              type="submit"
              className="submit-btn"

              // ปิดปุ่มระหว่างรอผลสมัคร
              disabled={isRegistering}

            >

              {/* เปลี่ยนข้อความตามสถานะสมัคร */}
              {isRegistering
                ? 'กำลังสมัคร...'
                : 'สมัครใช้งาน'}

            </button>
          </form>
        )}

      {/* จบกล่องหลัก */}
      </div>

    {/* จบพื้นที่ทั้งหน้า */}
    </div>

  ) // จบ JSX
} // จบ component Login

// เปิดให้ App.jsx import หน้านี้ไปใช้
export default Login