// import { useState } from 'react'
// import { useNavigate } from 'react-router-dom'
// import { useAuth } from '../hooks/useAuth'
// import './Login.css'

// function Register() {
//   const navigate = useNavigate()
//   const { setUser } = useAuth()

//   const [firstname, setFirstname] = useState('')
//   const [lastname, setLastname] = useState('')
//   const [username, setUsername] = useState('')
//   const [email, setEmail] = useState('')
//   const [password, setPassword] = useState('')
//   const [showPassword, setShowPassword] = useState(false)

//   const handleSubmit = (e) => {
//     e.preventDefault()
//     setUser(username)
//     navigate('/')
//   }

//   return (
//     <div className="login-page">
//       <div className="login-card">
//         <h1 className="login-title">สมัครใช้งาน</h1>

//         <form onSubmit={handleSubmit} className="login-form">
//           <label className="field-label">ชื่อ</label>
//           <input
//             type="text"
//             value={firstname}
//             onChange={(e) => setFirstname(e.target.value)}
//           />

//           <label className="field-label">นามสกุล</label>
//           <input
//             type="text"
//             value={lastname}
//             onChange={(e) => setLastname(e.target.value)}
//           />

//           <label className="field-label">ชื่อผู้ใช้งาน</label>
//           <input
//             type="text"
//             value={username}
//             onChange={(e) => setUsername(e.target.value)}
//           />

//           <label className="field-label">อีเมล</label>
//           <input
//             type="email"
//             value={email}
//             onChange={(e) => setEmail(e.target.value)}
//           />

//           <label className="field-label">รหัสผ่าน</label>
//           <div className="password-wrapper">
//             <input
//               type={showPassword ? 'text' : 'password'}
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//             />
//             <button
//               type="button"
//               className="toggle-password"
//               onClick={() => setShowPassword((v) => !v)}
//             >
//               {showPassword ? '🙈' : '👁️'}
//             </button>
//           </div>

//           <button type="submit" className="submit-btn">
//             สมัครใช้งาน
//           </button>
//         </form>
//       </div>
//     </div>
//   )
// }

// export default Register