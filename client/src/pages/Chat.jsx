import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import './Chat.css'

const mockSessions = [
  { id: 1, title: 'รายวิชาหลักสูตร ICT 01' },
  { id: 2, title: 'ตารางเรียนเทอม 2/2568' },
  { id: 3, title: 'วันสอบปลายภาคปีนี้' },
  { id: 4, title: 'หน่วยกิตรวมหลักสูตร' },
  { id: 5, title: 'วิชาเลือกเสรีที่เปิดรับ' },
]

const suggestionCards = [
  'อาจารย์ประจำหลักสูตร ICT มีใครบ้าง',
  'วิชาเลือกเสรีที่เปิดรับในเทอม 2 ปี 2569 มีอะไรบ้าง',
  'หลักสูตร ICT มีหน่วยกิตรวมเท่าไหร่',
  'วิชาที่เปิดสอนในหลักสูตร ICT มีอะไรบ้าง',
]

function Chat() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [activeSessionId, setActiveSessionId] = useState(1)
  const [message, setMessage] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [attachedFile, setAttachedFile] = useState(null)

  const handleSend = (e) => {
    e.preventDefault()
    if (!message.trim() && !attachedFile) return

    const userMessage = {
      role: 'user',
      text: message,
      fileName: attachedFile?.name,
    }
    setChatHistory((prev) => [...prev, userMessage])
    setMessage('')
    setAttachedFile(null)

    setTimeout(() => {
      const botMessage = {
        role: 'bot',
        text: 'อ่อ หรอออ',
      }
      setChatHistory((prev) => [...prev, botMessage])
    }, 500)
  }

  const handleSuggestionClick = (text) => {
    setMessage(text)
  }

  const handleNewChat = () => {
    setChatHistory([])
    setMessage('')
    setAttachedFile(null)
    setActiveSessionId(null)
  }

  const handleLogout = () => {
    setUser(null)
    navigate('/login')
  }

  const handleAttachClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) setAttachedFile(file)
    e.target.value = '' // เคลียร์ค่า input ไว้ เผื่อเลือกไฟล์เดิมซ้ำได้อีก
  }

  const hasMessages = chatHistory.length > 0

  return (
    <div className="chat-page">
      <aside className="chat-sidebar">
        <div className="sidebar-top">
          <div className="brand">
            <span className="brand-logo">🤖</span>
            <div>
              <p className="brand-name">Sci Assistant</p>
              <p className="brand-sub">PSU · คณะวิทยาศาสตร์</p>
            </div>
          </div>

          <button className="new-chat-btn" onClick={handleNewChat}>
            + สนทนาใหม่
          </button>

          <p className="sidebar-label">ล่าสุด</p>

          <ul className="session-list">
            {mockSessions.map((session) => (
              <li
                key={session.id}
                className={session.id === activeSessionId ? 'session active' : 'session'}
                onClick={() => setActiveSessionId(session.id)}
              >
                {session.title}
              </li>
            ))}
          </ul>
        </div>

        <div className="sidebar-user-wrap">
          {showUserMenu && (
            <div className="user-menu">
              <button className="user-menu-item" onClick={handleLogout}>
                🚪 ออกจากระบบ
              </button>
            </div>
          )}

          <div className="sidebar-user" onClick={() => setShowUserMenu((v) => !v)}>
            <div className="user-avatar">{user ? user[0]?.toUpperCase() : 'U'}</div>
            <div>
              <p className="user-name">{user || 'ผู้ใช้งาน'}</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="chat-main">
        <div className="chat-header">
          <span className="version-tag">RAG v1.0</span>
          <div className="header-avatar">{user ? user[0]?.toUpperCase() : 'U'}</div>
        </div>

        {!hasMessages ? (
          <div className="chat-welcome">
            <div className="chat-logo">🤖</div>
            <h2>สนทนาใหม่</h2>
            <p>ถามข้อมูลเกี่ยวกับหลักสูตร อาจารย์ หรือตารางเรียนได้เลยครับ</p>

            <div className="suggestion-grid">
              {suggestionCards.map((text, i) => (
                <button
                  key={i}
                  className="suggestion-card"
                  onClick={() => handleSuggestionClick(text)}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="chat-messages">
            {chatHistory.map((msg, i) => (
              <div
                key={i}
                className={msg.role === 'user' ? 'bubble user-bubble' : 'bubble bot-bubble'}
              >
                {msg.fileName && <div className="bubble-file"> + {msg.fileName}</div>}
                {msg.text}
              </div>
            ))}
          </div>
        )}

        {attachedFile && (
          <div className="attached-preview">
            <span> + {attachedFile.name}</span>
            <button type="button" onClick={() => setAttachedFile(null)}>
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleSend} className="chat-input-bar">
          <input
            type="file"
            ref={fileInputRef}
            hidden
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
          />
          <button
            type="button"
            className="attach-btn"
            title="แนบไฟล์"
            onClick={handleAttachClick}
          >
            +
          </button>
          <input
            type="text"
            placeholder="ถามข้อมูลเกี่ยวกับหลักสูตร อาจารย์ หรือรายวิชา..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button type="submit" className="send-btn">➤</button>
        </form>
      </main>
    </div>
  )
}

export default Chat