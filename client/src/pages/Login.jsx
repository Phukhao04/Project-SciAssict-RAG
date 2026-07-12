import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { authenRequest, accessRequest } from '../utils/authService'
import './Login.css'

function Login() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [mode, setMode] = useState('login')

  // ฟิลด์สำหรับ login
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // ฟิลด์เพิ่มเติมสำหรับ register
  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [email, setEmail] = useState('')

  // สถานะสำหรับ login
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setIsLoading(true)

    try {
      // ขั้นตอนที่ 1: authen_request
      const step1 = await authenRequest(username)

      if (step1.isError) {
        setErrorMessage(step1.errorMessage)
        return
      }

      const authenToken = step1.data

      // ขั้นตอนที่ 2: access_request
      const step2 = await accessRequest(username, password, authenToken)

      if (step2.isError) {
        setErrorMessage(step2.errorMessage)
        return
      }

      // login สำเร็จ
      setUser(username)
      navigate('/')
    } catch (err) {
      console.error(err)
      setErrorMessage('เกิดข้อผิดพลาดในการเชื่อมต่อ server')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegisterSubmit = (e) => {
    e.preventDefault()
    // TODO: ยังไม่มี endpoint สมัครสมาชิกที่ backend
    setUser(username)
    navigate('/')
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
          <form onSubmit={handleLoginSubmit} className="login-form">
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
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>

            {errorMessage && (
              <p className="error-message" style={{ color: 'red' }}>
                {errorMessage}
              </p>
            )}

            <button type="submit" className="submit-btn" disabled={isLoading}>
              {isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="login-form">
            <label className="field-label">ชื่อ</label>
            <input
              type="text"
              value={firstname}
              onChange={(e) => setFirstname(e.target.value)}
            />

            <label className="field-label">นามสกุล</label>
            <input
              type="text"
              value={lastname}
              onChange={(e) => setLastname(e.target.value)}
            />

            <label className="field-label">ชื่อผู้ใช้งาน</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />

            <label className="field-label">อีเมล</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label className="field-label">รหัสผ่าน</label>
            <div className="password-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>

            <button type="submit" className="submit-btn">
              สมัครใช้งาน
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default Login