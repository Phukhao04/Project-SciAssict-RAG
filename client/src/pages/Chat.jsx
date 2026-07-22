import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import './Chat.css'

const suggestionCards = [
  'อาจารย์ประจำหลักสูตร ICT มีใครบ้าง',
  'วิชาเลือกเสรีที่เปิดรับในเทอม 2 ปี 2569 มีอะไรบ้าง',
  'หลักสูตร ICT มีหน่วยกิตรวมเท่าไหร่',
  'วิชาที่เปิดสอนในหลักสูตร ICT มีอะไรบ้าง',
]

function Chat() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()

  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [message, setMessage] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [attachedFile, setAttachedFile] = useState(null)
  const [isSending, setIsSending] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)

  const fileInputRef = useRef(null)

  const handleSend = (e) => {
    e.preventDefault()
    const trimmed = message.trim()
    if (!trimmed || isSending || !user?.user_id) return

    const userMessage = { role: 'user', text: trimmed }
    setChatHistory((prev) => [...prev, userMessage])
    setMessage('')
    setAttachedFile(null)
    setIsSending(true)

    setTimeout(() => {
      const botMessage = {
        role: 'bot',
        text: 'อ่อ หรอออ',
      }
      setChatHistory((prev) => [...prev, botMessage])
      setIsSending(false)
    }, 500)
  }

  const handleSuggestionClick = (text) => {
    setMessage(text)
  }

  const handleNewChat = () => {
    // ไม่ยิง API ตรงนี้ -- รอจนกว่าจะพิมพ์คำถามแรกจริง backend ถึงจะสร้าง session ให้เอง
    setChatHistory([])
    setMessage('')
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
  const avatarLetter = user?.username ? user.username[0].toUpperCase() : 'U'

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
            {sessions.map((session) => (
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
            <div className="user-avatar">{avatarLetter}</div>
            <div>
              <p className="user-name">{user?.username || 'ผู้ใช้งาน'}</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="chat-main">
        <div className="chat-header">
          <span className="version-tag">RAG v1.0</span>
          <div className="header-avatar">{avatarLetter}</div>
        </div>

        {isLoadingMessages ? (
          <div className="chat-welcome">
            <p>กำลังโหลดบทสนทนา...</p>
          </div>
        ) : !hasMessages ? (
          <div className="chat-welcome">
            <div className="chat-logo">🤖</div>
            <h2>สนทนาใหม่</h2>
            <p>ถามข้อมูลเกี่ยวกับหลักสูตร อาจารย์ หรือตารางเรียนได้เลยครับ</p>

            <div className="suggestion-grid">
              {suggestionCards.map((text, i) => (
                <button key={i} className="suggestion-card" onClick={() => handleSuggestionClick(text)}>
                  {text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="chat-messages">
            {chatHistory.map((msg, i) => (
              <div key={i} className={msg.role === 'user' ? 'bubble user-bubble' : 'bubble bot-bubble'}>
                {msg.text}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="bubble-sources">อ้างอิงจาก: {msg.sources.join(', ')}</div>
                )}
              </div>
            ))}
            {isSending && <div className="bubble bot-bubble bubble-loading">กำลังค้นหาคำตอบ...</div>}
          </div>
        )}

        <form onSubmit={handleSend} className="chat-input-bar">
          <input
            type="text"
            placeholder="ถามข้อมูลเกี่ยวกับหลักสูตร อาจารย์ หรือรายวิชา..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isSending}
          />
          <button type="submit" className="send-btn" disabled={isSending}>
            {isSending ? '...' : '➤'}
          </button>
        </form>
      </main>
    </div>
  )
}

export default Chat