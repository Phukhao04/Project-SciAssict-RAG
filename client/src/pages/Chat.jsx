import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { chatRequest, getSessions, getSessionMessages } from '../utils/ragService'
import './Chat.css'

// const suggestionCards = [
//   'อาจารย์ประจำหลักสูตร ICT มีใครบ้าง',
//   'วิชาเลือกเสรีที่เปิดรับในเทอม 2 ปี 2569 มีอะไรบ้าง',
//   'หลักสูตร ICT มีหน่วยกิตรวมเท่าไหร่',
//   'วิชาที่เปิดสอนในหลักสูตร ICT มีอะไรบ้าง',
// ]

function Chat() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()

  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [message, setMessage] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const messagesEndRef = useRef(null)

  // โหลด session list ตอนเปิดหน้าครั้งแรก
  useEffect(() => {
    if (!user?.user_id) return
    getSessions(user.user_id).then(setSessions)
  }, [user?.user_id])

  // เลื่อนไปล่างสุดอัตโนมัติทุกครั้งที่มีข้อความใหม่ (ทั้งของ user และ bot)
  // รวมถึงตอน isSending เปลี่ยน (โชว์ bubble "กำลังค้นหาคำตอบ...")
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, isSending])

  const handleSessionClick = async (sessionId) => {
    setActiveSessionId(sessionId)
    const messages = await getSessionMessages(sessionId)
    // แปลง sender_role ('user'/'bot') จาก backend ให้ตรงกับ role ที่ UI ใช้อยู่แล้ว
    setChatHistory(
      messages.map((m) => ({ role: m.sender_role, text: m.message_text }))
    )
  }

  const handleSend = async (e) => {
    e.preventDefault()
    const trimmed = message.trim()
    if (!trimmed || isSending || !user?.user_id) return

    const userMessage = { role: 'user', text: trimmed }
    setChatHistory((prev) => [...prev, userMessage])
    setMessage('')
    setIsSending(true)

    try {
      const result = await chatRequest(trimmed, user.user_id, activeSessionId)

      if (result.isError) {
        setChatHistory((prev) => [...prev, { role: 'bot', text: result.errorMessage, isError: true }])
        return
      }

      setChatHistory((prev) => [...prev, { role: 'bot', text: result.answer, sources: result.sources }])

      // ถ้าเป็นข้อความแรก (ไม่เคยมี activeSessionId มาก่อน) -> เพิ่งสร้าง session ใหม่จาก backend
      // ต้องอัปเดต state + โหลด session list ใหม่ ให้โผล่ในแถบซ้ายทันที
      if (!activeSessionId) {
        setActiveSessionId(result.sessionId)
        const updatedSessions = await getSessions(user.user_id)
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

  // const handleSuggestionClick = (text) => {
  //   setMessage(text)
  // }

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

  const hasMessages = chatHistory.length > 0
  const avatarLetter = user?.username ? user.username[0].toUpperCase() : 'U'
  const isAdmin = user?.role_id === 'R01'

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

          {/* ย้ายปุ่มสลับไปหน้า Admin มาไว้ที่นี่ (เดิมอยู่ใน chat-header ขวาบน)
              เพื่อให้ตำแหน่ง "สลับหน้า" อยู่โซน navigation ของ sidebar เหมือนกับ
              ปุ่ม "กลับหน้าแชท" ที่ฝั่ง AdminSidebar ผู้ใช้จะเจอปุ่มสลับหน้าที่ตำแหน่ง
              เดียวกันเสมอไม่ว่าจะอยู่หน้าไหน (positional consistency) */}
          {isAdmin && (
            <button className="admin-link-btn" onClick={() => navigate('/admin')}>
              ⚙ ไปหน้า Admin
            </button>
          )}

          <p className="sidebar-label">ล่าสุด</p>

          <ul className="session-list">
            {sessions.map((session) => (
              <li
                key={session.session_id}
                className={session.session_id === activeSessionId ? 'session active' : 'session'}
                onClick={() => handleSessionClick(session.session_id)}
              >
                {session.session_title || 'สนทนาไม่มีชื่อ'}
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
        </div>

        {!hasMessages ? (
          <div className="chat-welcome">
            <div className="chat-logo">🤖</div>
            <h2>สนทนาใหม่</h2>
            <p>ถามข้อมูลเกี่ยวกับคณะวิทยาศาสตร์ หลักสูตร หรืออาจารย์</p>

            {/* <div className="suggestion-grid">
              {suggestionCards.map((text, i) => (
                <button key={i} className="suggestion-card" onClick={() => handleSuggestionClick(text)}>
                  {text}
                </button>
              ))}
            </div> */}
          </div>
        ) : (
          <div className="chat-messages">
            {chatHistory.map((msg, i) => (
              <div key={i} className={msg.role === 'user' ? 'bubble user-bubble' : 'bubble bot-bubble'}>
                {msg.text}
              </div>
            ))}
            {isSending && <div className="bubble bot-bubble bubble-loading">กำลังค้นหาคำตอบ...</div>}
            <div ref={messagesEndRef} />
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