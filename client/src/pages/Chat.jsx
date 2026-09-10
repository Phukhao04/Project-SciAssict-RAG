import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Atom,
  History,
  Plus,
  Settings,
  LogOut,
  User,
  Send,
  FlaskConical,
  Dna,
  Cpu,
  HeartPulse,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { chatRequest, getSessions, getSessionMessages } from '../utils/ragService'
import './Chat.css'

/* badge 4 สาขาจริงของคณะ: กายภาพ / ชีวภาพ / คำนวณ / สุขภาพและประยุกต์
   ใช้ไอคอนจาก lucide-react แทน SVG มือเขียน */
const BRANCH_ICONS = [
  { title: 'วิทยาศาสตร์กายภาพ', Icon: FlaskConical },
  { title: 'วิทยาศาสตร์ชีวภาพ', Icon: Dna },
  { title: 'วิทยาศาสตร์การคำนวณ', Icon: Cpu },
  { title: 'วิทยาศาสตร์สุขภาพและประยุกต์', Icon: HeartPulse },
]

function Chat() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()

  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [message, setMessage] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [isSending, setIsSending] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!user?.user_id) return
    // แก้: getSessions ไม่รับ user_id แล้ว เพราะ backend ดึงจาก JWT เอง (กัน IDOR)
    getSessions().then(setSessions)
  }, [user?.user_id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, isSending])

  const handleSessionClick = async (sessionId) => {
    setActiveSessionId(sessionId)
    setHistoryOpen(false)
    const messages = await getSessionMessages(sessionId)
    setChatHistory(
      messages.map((m) => ({ role: m.sender_role, text: m.message_text, sources: m.sources }))
    )
  }

  const sendMessage = async (text) => {
    const trimmed = text.trim()
    if (!trimmed || isSending || !user?.user_id) return

    setChatHistory((prev) => [...prev, { role: 'user', text: trimmed }])
    setMessage('')
    setIsSending(true)

    try {
      const result = await chatRequest(trimmed, user.user_id, activeSessionId)

      if (result.isError) {
        setChatHistory((prev) => [...prev, { role: 'bot', text: result.errorMessage, isError: true }])
        return
      }

      setChatHistory((prev) => [...prev, { role: 'bot', text: result.answer, sources: result.sources }])

      if (!activeSessionId) {
        setActiveSessionId(result.sessionId)
        // แก้: getSessions ไม่รับ user_id แล้ว เช่นเดียวกับด้านบน
        const updatedSessions = await getSessions()
        setSessions(updatedSessions)
      }
    } catch (err) {
      console.error(err)
      setChatHistory((prev) => [
        ...prev,
        { role: 'bot', text: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง', isError: true },
      ])
    } finally {
      setIsSending(false)
    }
  }

  const handleSend = (e) => {
    e.preventDefault()
    sendMessage(message)
  }

  const handleNewChat = () => {
    setChatHistory([])
    setMessage('')
    setActiveSessionId(null)
    setHistoryOpen(false)
    inputRef.current?.focus()
  }

  const handleLogout = () => {
    setUser(null)
    navigate('/login')
  }

  const hasMessages = chatHistory.length > 0
  const avatarLetter = user?.username ? user.username[0].toUpperCase() : 'U'
  const isAdmin = user?.role_id === 'R01'

  return (
    <div className="chat-page">
      {/* ===== แถบไอคอนลอย ===== */}
      <div className="rail">
        <div className="rail-logo"><Atom size={20} color="#0B1150" /></div>

        <div
          className={`rail-btn${historyOpen ? ' active' : ''}`}
          onClick={() => setHistoryOpen((v) => !v)}
          title="ประวัติการสนทนา"
        >
          <History size={19} />
        </div>

        <div className="rail-btn" onClick={handleNewChat} title="สนทนาใหม่">
          <Plus size={19} />
        </div>

        {isAdmin && (
          <div className="rail-btn" onClick={() => navigate('/admin')} title="ไปหน้า Admin">
            <Settings size={18} />
          </div>
        )}

        <div className="rail-spacer" />

        <div className="rail-avatar-wrap">
          {userMenuOpen && (
            <div className="rail-user-menu">
              <div className="rail-user-menu-name">{user?.username}</div>
              <button className="rail-user-menu-item rail-user-menu-item-profile" onClick={() => navigate('/profile')}>
                <User size={14} /> แก้ไขข้อมูลส่วนตัว
              </button>
              <button className="rail-user-menu-item" onClick={handleLogout}>
                <LogOut size={14} /> ออกจากระบบ
              </button>
            </div>
          )}
          <div className="rail-avatar" onClick={() => setUserMenuOpen((v) => !v)} title={user?.username}>
            {avatarLetter}
          </div>
        </div>
      </div>

      {/* ===== ประวัติแบบเลื่อนทับ ===== */}
      <div className={`history-drawer${historyOpen ? ' open' : ''}`}>
        <h3>ประวัติการสนทนา</h3>
        {sessions.length === 0 ? (
          <p className="history-empty">ยังไม่มีประวัติการสนทนา</p>
        ) : (
          sessions.map((session) => (
            <div
              key={session.session_id}
              className={session.session_id === activeSessionId ? 'history-item active' : 'history-item'}
              onClick={() => handleSessionClick(session.session_id)}
            >
              {session.session_title || 'สนทนาไม่มีชื่อ'}
            </div>
          ))
        )}
      </div>
      {historyOpen && <div className="drawer-backdrop" onClick={() => setHistoryOpen(false)} />}

      {/* ===== พื้นที่หลัก ===== */}
      <div className="main">
        <div className="wave-header">
          <div className="wave-top">
            <div>
              <div className="wave-title">Sci Assistant</div>
              <div className="wave-sub">คณะวิทยาศาสตร์ ม.อ. หาดใหญ่</div>
            </div>
            <div className="wave-tag">RAG v1.0</div>
          </div>
        </div>

        {!hasMessages ? (
          <div className="welcome">
            <div className="welcome-badges">
              {BRANCH_ICONS.map(({ title, Icon }) => (
                <div className="badge" key={title} title={title}>
                  <Icon size={24} color="#0B1150" strokeWidth={1.7} />
                </div>
              ))}
            </div>
            <h1>สวัสดี พร้อมตอบทุกคำถามคณะวิทย์</h1>
            <p>ถามเรื่องหลักสูตร อาจารย์ รายวิชา หรือขั้นตอนต่างๆ ได้เลย คำตอบทุกอันอ้างอิงจากเอกสารจริงของคณะ</p>
          </div>
        ) : (
          <div className="messages">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`row ${msg.role === 'user' ? 'user' : ''}`}>
                {msg.role !== 'user' && (
                  <div className="avatar bot"><Atom size={14} color="#FFD400" /></div>
                )}
                <div className={msg.role === 'user' ? 'bubble-user' : `bubble-bot${msg.isError ? ' bubble-error' : ''}`}>
                  {msg.text}
                </div>
                {msg.role === 'user' && <div className="avatar user">{avatarLetter}</div>}
              </div>
            ))}
            {isSending && (
              <div className="row">
                <div className="avatar bot"><Atom size={14} color="#FFD400" /></div>
                <div className="bubble-bot">
                  <div className="typing">
                    <span className="dot" /><span className="dot" /><span className="dot" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        <div className="input-zone">
          <form className="input-bar" onSubmit={handleSend}>
            <input
              ref={inputRef}
              type="text"
              placeholder="ถามอะไรก็ได้เกี่ยวกับคณะวิทย์..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isSending}
            />
            <button type="submit" className="send-btn" disabled={isSending || !message.trim()} aria-label="ส่งข้อความ">
              <Send size={16} />
            </button>
          </form>
          <p className="disclaimer">คำตอบสร้างจากเอกสารของคณะ อาจมีความคลาดเคลื่อนได้</p>
        </div>
      </div>
    </div>
  )
}

export default Chat