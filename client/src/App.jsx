import { Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home'
import About from './pages/About'
import Login from './pages/Login'
import Chat from './pages/Chat'
import Dashboard from './pages/admin/Dashboard'
import UploadDocument from './pages/admin/UploadDocument'
import './App.css'

function App() {
  return (
    <div>
      <nav>
        <Link to="/">Home</Link> | <Link to="/about">About</Link> |{' '}
        <Link to="/login">Login</Link> | <Link to="/chat">Chat</Link> |{' '}
        <Link to="/admin">Admin</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/login" element={<Login />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/admin" element={<Dashboard />} />
        <Route path="/admin/upload" element={<UploadDocument />} />
      </Routes>
    </div>
  )
}

export default App