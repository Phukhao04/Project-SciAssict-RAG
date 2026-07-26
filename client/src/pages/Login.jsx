import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  authenRequest,
  accessRequest,
  registerRequest,
} from '../utils/authService'
import './Login.css'

// role_id คงที่สำหรับ user ที่สมัครเอง
const DEFAULT_ROLE_ID = 'R02'

function Login() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [mode, setMode] = useState('login')

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [email, setEmail] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const [registerFieldErrors, setRegisterFieldErrors] = useState({})
  const [registerGeneralError, setRegisterGeneralError] = useState('')
  const [registerSuccessMessage, setRegisterSuccessMessage] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)

  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setIsLoading(true)

    try {
      const step1 = await authenRequest(username)

      if (step1.isError) {
        setErrorMessage(step1.errorMessage)
        return
      }

      const authenToken = step1.data

      const step2 = await accessRequest(
        username,
        password,
        authenToken
      )

      if (step2.isError) {
        setErrorMessage(step2.errorMessage)
        return
      }

      const user = {
        user_id: step2.data.user_id,
        username: step2.data.username,
        firstname: step2.data.firstname,
        lastname: step2.data.lastname,
        role_id: step2.data.role_id,
      }

      setUser(user)

      // เช็คสิทธิ์
      if (user.role_id === 'R01') {
        navigate('/admin')
      } else {
        navigate('/')
      }
    } catch (err) {
      console.error(err)
      setErrorMessage('เกิดข้อผิดพลาดในการเชื่อมต่อ server')
    } finally {
      setIsLoading(false)
    }
  }

  const validateRegisterClientSide = () => {
    const errors = {}

    if (username.trim().length < 3 || username.trim().length > 50) {
      errors.username = 'ชื่อผู้ใช้ต้องมีความยาว 3-50 ตัวอักษร'
    }

    if (password.length < 8) {
      errors.password = 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'รหัสผ่านไม่ตรงกัน'
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!emailPattern.test(email)) {
      errors.email = 'รูปแบบอีเมลไม่ถูกต้อง'
    }

    setRegisterFieldErrors(errors)

    return Object.keys(errors).length === 0
  }

  const handleRegisterSubmit = async (e) => {
    e.preventDefault()

    setRegisterGeneralError('')
    setRegisterSuccessMessage('')

    if (!validateRegisterClientSide()) {
      return
    }

    setIsRegistering(true)

    try {
      const result = await registerRequest({
        username: username.trim(),
        password,
        email: email.trim(),
        roleId: DEFAULT_ROLE_ID,
        firstname: firstname.trim(),
        lastname: lastname.trim(),
      })

      if (!result.isError) {
        setRegisterSuccessMessage(
          'สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ'
        )

        setPassword('')
        setConfirmPassword('')
        setMode('login')

        return
      }

      if (result.fieldErrors) {
        setRegisterFieldErrors(result.fieldErrors)
      } else {
        setRegisterFieldErrors({
          username: result.errorMessage,
        })
      }
    } catch (err) {
      console.error(err)
      setRegisterGeneralError(
        'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง'
      )
    } finally {
      setIsRegistering(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Sci Assistant</h1>

        <div className="login-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'tab active' : 'tab'}
            onClick={() => setMode('login')}
          >
            เข้าสู่ระบบ
          </button>

          <button
            type="button"
            className={mode === 'register' ? 'tab active' : 'tab'}
            onClick={() => setMode('register')}
          >
            สมัครใช้งาน
          </button>
        </div>

        {mode === 'login' && (
          <form
            onSubmit={handleLoginSubmit}
            className="login-form"
          >
            {registerSuccessMessage && (
              <p className="success-text">
                {registerSuccessMessage}
              </p>
            )}

            <label className="field-label">Username</label>

            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />

            <label className="field-label">รหัสผ่าน</label>

            <div className="password-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
              />

              <button
                type="button"
                className="toggle-password"
                onClick={() =>
                  setShowPassword((v) => !v)
                }
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>

            {errorMessage && (
              <p
                className="error-message"
                style={{ color: 'red' }}
              >
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              className="submit-btn"
              disabled={isLoading}
            >
              {isLoading
                ? 'กำลังเข้าสู่ระบบ...'
                : 'เข้าสู่ระบบ'}
            </button>
          </form>
        )}

        {mode === 'register' && (
          <form
            onSubmit={handleRegisterSubmit}
            className="login-form"
          >
            {registerGeneralError && (
              <p className="error-text">
                {registerGeneralError}
              </p>
            )}

            <label className="field-label">ชื่อ</label>

            <input
              type="text"
              value={firstname}
              onChange={(e) =>
                setFirstname(e.target.value)
              }
            />

            <label className="field-label">นามสกุล</label>

            <input
              type="text"
              value={lastname}
              onChange={(e) =>
                setLastname(e.target.value)
              }
            />

            <label className="field-label">
              ชื่อผู้ใช้งาน
            </label>

            <input
              type="text"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value)
              }
              required
            />

            {registerFieldErrors.username && (
              <p className="error-text">
                {registerFieldErrors.username}
              </p>
            )}

            <label className="field-label">อีเมล</label>

            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              required
            />

            {registerFieldErrors.email && (
              <p className="error-text">
                {registerFieldErrors.email}
              </p>
            )}

            <label className="field-label">รหัสผ่าน</label>

            <div className="password-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                required
                minLength={8}
              />

              <button
                type="button"
                className="toggle-password"
                onClick={() =>
                  setShowPassword((v) => !v)
                }
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>

            {registerFieldErrors.password && (
              <p className="error-text">
                {registerFieldErrors.password}
              </p>
            )}

            <label className="field-label">
              ยืนยันรหัสผ่าน
            </label>

            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(e.target.value)
              }
              required
            />

            {registerFieldErrors.confirmPassword && (
              <p className="error-text">
                {registerFieldErrors.confirmPassword}
              </p>
            )}

            <button
              type="submit"
              className="submit-btn"
              disabled={isRegistering}
            >
              {isRegistering
                ? 'กำลังสมัคร...'
                : 'สมัครใช้งาน'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default Login