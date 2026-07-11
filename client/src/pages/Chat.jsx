import { useState } from 'react'
import './Chat.css'

const mockSessions = [
  { id: 1, title: 'รายวิชาหลักสูตร ICT 01' },
  { id: 2, title: 'ตารางเรียนเทอม 2/2568' },
  { id: 3, title: 'วันสอบปลายภาคปีนี้' },
  { id: 4, title: 'หน่วยกิตรวมหลักสูตร' },
  { id: 5, title: 'วิชาเลือกเสรีที่เปิดรับ' },
]

const suggestionCards = [
  'Sci 308-312 มีแผนใครเป็นเจ้าของวิชา',
  'อัตสาสาขา ครีเดียร์ เวลย์วิชาการ ครับ',
  'หลักสูตร ICT มีที่นั่งเปิดกี่กี่',
  'วิชาบังคับชั้นปีที่ 1 มีวิชาอะไรบ้าง',
]

function Chat() {
  const [activeSessionId, setActiveSessionId] = useState(1)
  const [message, setMessage] = useState('')
  const [chatHistory, setChatHistory] = useState([])

  const handleSend = (e) => {
    e.preventDefault()
    if (!message.trim()) return

    const userMessage = { role: 'user', text: message }
    setChatHistory((prev) => [...prev, userMessage])
    setMessage('')

    setTimeout(() => {
      const botMessage = {
        role: 'bot',
        text: 'นี่คือคำตอบจำลอง จะเชื่อมกับ backend จริงในขั้นถัดไป',
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
    setActiveSessionId(null) // ไม่มี session ไหนถูกเลือกอยู่ตอนนี้
  }

  const hasMessages = chatHistory.length > 0

  return (
    <div className="chat-page">
      <aside className="chat-sidebar">
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
      </aside>

      <main className="chat-main">
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
                {msg.text}
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSend} className="chat-input-bar">
          <input
            type="text"
            placeholder="ถามข้อมูลเกี่ยวกับหลักสูตร อาจารย์ หรือรายวิชา..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button type="submit">➤</button>
        </form>
      </main>
    </div>
  )
}

export default Chat