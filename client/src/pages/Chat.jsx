import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Atom,
  History,
  Plus,
  Settings,
  LogOut,
  Send,
  ChevronUp,
  ChevronDown,
  FileText,
  FlaskConical,
  Dna,
  Cpu,
  HeartPulse,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { chatRequest, getSessions, getSessionMessages } from '../utils/ragService'
import './Chat.css'
import logo from '../assets/logo.jpg'

const BRANCH_ICONS = [
  { title: 'วิทยาศาสตร์กายภาพ', Icon: FlaskConical },
  { title: 'วิทยาศาสตร์ชีวภาพ', Icon: Dna },
  { title: 'วิทยาศาสตร์การคำนวณ', Icon: Cpu },
  { title: 'วิทยาศาสตร์สุขภาพและประยุกต์', Icon: HeartPulse },
]

/* --------------------------------------------------------------
   แถบแหล่งอ้างอิง — ผูกกับแก่นของ RAG โดยตรง ทุกคำตอบ bot ต้องโชว์
   ได้ว่ามาจากเอกสาร/chunk ไหน ปรับ field name ใน normalizeSource()
   ถ้ารูปแบบจริงจาก ragService ไม่ตรงกับที่เดาไว้
   -------------------------------------------------------------- */
function normalizeSource(s, i) {
  return {
    id: s.chunk_id || s.id || `source_${i}`,
    doc: s.doc_name || s.document_name || s.filename || s.title || 'เอกสารอ้างอิง',
    snippet: s.snippet || s.content || s.text || s.chunk_text || '',
  }
}

function CitationRow({ sources }) {
  const [openId, setOpenId] = useState(null)
  if (!sources?.length) return null
  const items = sources.map(normalizeSource)

  return (
    <div className="citations">
      <p className="citations-label">แหล่งอ้างอิง</p>
      <div className="citation-list">
        {items.map((c) => {
          const open = openId === c.id
          return (
            <div key={c.id} className="citation-wrap">
              <button type="button" className="citation-chip" onClick={() => setOpenId(open ? null : c.id)}>
                <FileText size={13} />
                <span className="citation-doc">{c.doc}</span>
                <span className="citation-id">{c.id}</span>
                {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {open && c.snippet && <p className="citation-snippet">{c.snippet}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

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
    getSessions(user.user_id).then(setSessions)
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

  //logo
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
        )}

        <div className="rail-spacer" />

        <div className="rail-avatar-wrap">
          {userMenuOpen && (
            <div className="rail-user-menu">
              <p className="rail-user-menu-name">{user?.username || 'ผู้ใช้งาน'}</p>
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
          <div className="messages">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`row ${msg.role === 'user' ? 'user' : ''}`}>
                {msg.role !== 'user' && (
                  <div className="avatar bot"><Atom size={14} color="#FFD400" /></div>
                )}
                <div className={msg.role === 'user' ? 'bubble-user' : `bubble-bot${msg.isError ? ' bubble-error' : ''}`}>
                  {msg.text}
                  {msg.role !== 'user' && !msg.isError && <CitationRow sources={msg.sources} />}
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