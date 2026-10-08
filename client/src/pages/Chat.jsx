// ============================================================
// ไฟล์: client/src/pages/Chat.jsx
//
// หน้าที่:
//   1) โหลดรายการห้องแชทของผู้ใช้
//   2) เปิดข้อความในห้องแชทที่เลือก
//   3) ส่งคำถามให้ backend ผ่าน ragService.js
//   4) แสดงคำถาม คำตอบ และแหล่งอ้างอิง
//   5) เริ่มแชทใหม่ เปิดเมนูผู้ใช้ และออกจากระบบ
//
// แยกข้อมูลสำคัญให้ออก:
//   sessions = รายการห้องแชททั้งหมดในเมนูประวัติ
//   activeSessionId = รหัสห้องแชทที่กำลังเปิด
//   chatHistory = ข้อความที่แสดงในห้องแชทปัจจุบัน
//   message = ข้อความที่กำลังพิมพ์ ยังไม่ได้ส่ง
//
// ลำดับการส่งคำถาม:
//   พิมพ์ → ส่งฟอร์ม → handleSend → sendMessage
//   → แสดงคำถามบนหน้าจอ → chatRequest ติดต่อ backend
//   → แสดงคำตอบ → ปิดสถานะกำลังส่ง
// ============================================================

// useState = เก็บข้อมูลที่เปลี่ยนแล้วต้องอัปเดตหน้าจอ
// useEffect = ทำงานหลัง render ตามค่าที่กำหนดให้ติดตาม
// useRef = เก็บค่าอ้างอิง เช่น อ้างถึงช่องกรอกหรือ element บนหน้าจอ
import { useState, useEffect, useRef } from 'react'

// ใช้รับฟังก์ชันสำหรับเปลี่ยนหน้า
import { useNavigate } from 'react-router-dom'

// นำเข้า component ไอคอนจาก lucide-react
import {
  Atom, // โลโก้อะตอม
  History, // ประวัติการสนทนา
  Plus, // เริ่มสนทนาใหม่
  Settings, // ไปหน้าแอดมิน
  LogOut, // ออกจากระบบ
  User, // ข้อมูลส่วนตัว
  Send, // ส่งข้อความ
  FlaskConical, // ไอคอนขวดทดลอง
  Dna, // ไอคอน DNA
  Cpu, // ไอคอนหน่วยประมวลผล
  HeartPulse, // ไอคอนหัวใจ
} from 'lucide-react'

// อ่านข้อมูลผู้ใช้และฟังก์ชันแก้ข้อมูลผู้ใช้จาก AuthContext
import { useAuth } from '../hooks/useAuth'

// นำเข้าฟังก์ชันคุยกับ backend ที่เราอธิบายไปแล้ว
// chatRequest = ส่งคำถาม
// getSessions = ดึงรายการห้องแชท
// getSessionMessages = ดึงข้อความในห้องที่เลือก
import { chatRequest, getSessions, getSessionMessages } from '../utils/ragService'

// ใช้ที่อยู่ backend สำหรับสร้างลิงก์ไฟล์อ้างอิง
import AppConfig from '../config/appConfig'

// โหลด CSS ของหน้าแชท
import './Chat.css'

// รายการไอคอนที่แสดงบนหน้าต้อนรับ
// แต่ละออบเจ็กต์มีชื่อ title และ component ไอคอนในช่อง Icon
// ตัว I ใหญ่ ทำให้สามารถนำไปเรียกใน JSX ด้วย <Icon /> ได้
const BRANCH_ICONS = [
  { title: 'วิทยาศาสตร์กายภาพ', Icon: FlaskConical },
  { title: 'วิทยาศาสตร์ชีวภาพ', Icon: Dna },
  { title: 'วิทยาศาสตร์การคำนวณ', Icon: Cpu },
  { title: 'วิทยาศาสตร์สุขภาพและประยุกต์', Icon: HeartPulse },
]

// สร้าง component หน้าสนทนา
function Chat() {

  // user = ข้อมูลผู้ใช้ปัจจุบัน
  // setUser = ฟังก์ชันเปลี่ยนข้อมูลผู้ใช้ใน context
  const { user, setUser } = useAuth()

  // รับฟังก์ชันไว้สั่งเปลี่ยนหน้า
  const navigate = useNavigate()

  // ==========================================================
  // ช่วงที่ 1: ตัวแปรเก็บสถานะของหน้าจอ
  // ==========================================================

  // รายการห้องแชท เริ่มต้นเป็น array ว่าง
  const [sessions, setSessions] = useState([])

  // รหัสห้องที่กำลังเปิด
  // null = ยังไม่ได้ระบุห้อง เช่น ตอนเริ่มแชทใหม่
  const [activeSessionId, setActiveSessionId] = useState(null)

  // ข้อความในช่องพิมพ์ เริ่มต้นว่าง
  const [message, setMessage] = useState('')

  // รายการข้อความในห้องที่กำลังแสดง
  // แต่ละข้อความมีข้อมูล เช่น role, text และ sources
  const [chatHistory, setChatHistory] = useState([])

  // true = กำลังรอการส่งคำถามและรับผลให้เสร็จ
  const [isSending, setIsSending] = useState(false)

  // true = เปิดแถบประวัติการสนทนา
  const [historyOpen, setHistoryOpen] = useState(false)

  // true = เปิดเมนูข้อมูลผู้ใช้และออกจากระบบ
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  // อ้างถึง element ที่อยู่ท้ายรายการข้อความ
  // ใช้เป็นเป้าหมายสำหรับเลื่อนหน้าจอลงไปท้ายแชท
  const messagesEndRef = useRef(null)

  // อ้างถึงช่องกรอกข้อความ
  // ใช้สั่งให้เคอร์เซอร์กลับไปอยู่ในช่องนั้น
  const inputRef = useRef(null)

  // ==========================================================
  // ช่วงที่ 2: โหลดรายการห้อง และเลื่อนหน้าจอ
  // ==========================================================

  // ทำงานหลัง component แสดงครั้งแรก
  // และเมื่อค่า user?.user_id เปลี่ยน
  useEffect(() => {

    // ถ้ายังไม่มีรหัสผู้ใช้ ให้หยุด ไม่โหลดรายการแชท
    // ?. = อ่านค่าโดยไม่ error เมื่อ user เป็น null หรือ undefined
    if (!user?.user_id) return

    // แก้: getSessions ไม่รับ user_id แล้ว เพราะ backend ดึงจาก JWT เอง (กัน IDOR)

    // เรียกดึงรายการห้องแชท
    // .then(setSessions) = เมื่อ Promise สำเร็จ นำผลไปให้ setSessions
    // ทำให้รายการห้องถูกเก็บใน state และหน้าจออัปเดต
    // ส่วนนี้ไม่มี catch สำหรับกรณี getSessions ถูก reject
    getSessions().then(setSessions)

  }, [user?.user_id]) // dependency: ติดตามรหัสผู้ใช้

  // ทำงานหลัง render เมื่อรายการข้อความหรือสถานะกำลังส่งเปลี่ยน
  useEffect(() => {

    // .current = element จริงที่ ref อ้างถึง
    // ?. = ถ้ายังไม่มี element ให้ข้ามการเรียก
    // scrollIntoView = เลื่อนให้ element ท้ายแชทเข้ามาอยู่ในมุมมอง
    // smooth = เลื่อนแบบนุ่มนวล
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })

  }, [chatHistory, isSending])

  // ==========================================================
  // ช่วงที่ 3: เปิดห้องแชทเก่า
  // ==========================================================

  // รับ sessionId ของห้องที่ผู้ใช้คลิก
  const handleSessionClick = async (sessionId) => {

    // ตั้งห้องที่เลือกเป็นห้องปัจจุบัน
    setActiveSessionId(sessionId)

    // ปิดแถบประวัติหลังเลือกห้อง
    setHistoryOpen(false)

    // ขอข้อความของห้องนั้นจาก backend แล้วรอผล
    const messages = await getSessionMessages(sessionId)

    // แปลงรูปแบบข้อความจาก backend ให้ตรงกับรูปแบบที่หน้าจอนี้ใช้
    setChatHistory(

      // map = อ่านแต่ละรายการและสร้าง array ใหม่
      // m = ข้อความหนึ่งรายการจาก backend
      // sender_role → role, message_text → text
      // sources ยังคงใช้ชื่อเดิม
      messages.map((m) => ({ role: m.sender_role, text: m.message_text, sources: m.sources }))

    )
  } // จบ handleSessionClick

  // ==========================================================
  // ช่วงที่ 4: ส่งคำถามและรับคำตอบ
  // ==========================================================

  // รับข้อความที่ต้องการส่งผ่านพารามิเตอร์ text
  const sendMessage = async (text) => {

    // ตัดช่องว่างต้นและท้ายข้อความ
    // เก็บผลเป็น trimmed โดยไม่แก้ตัวแปร text
    const trimmed = text.trim()

    // หยุดถ้า:
    //   ข้อความว่าง หรือกำลังส่งอยู่ หรือไม่มีรหัสผู้ใช้
    // || = หรือ
    if (!trimmed || isSending || !user?.user_id) return

    // เพิ่มคำถามของผู้ใช้เข้าไปท้ายรายการข้อความทันที
    // prev = chatHistory ก่อนหน้า
    // ...prev = นำรายการเก่าทั้งหมดมาใส่ใน array ใหม่
    // แล้วต่อท้ายด้วยข้อความใหม่
    setChatHistory((prev) => [...prev, { role: 'user', text: trimmed }])

    // ล้างข้อความในช่องกรอก
    setMessage('')

    // เปิดสถานะกำลังส่ง เพื่อปิดช่องกรอก/ปุ่มและแสดงจุดรอคำตอบ
    setIsSending(true)

    try {

      // ส่งคำถาม รหัสผู้ใช้ และรหัสห้องไปให้ ragService
      // ถ้า activeSessionId เป็น null จะส่งโดยยังไม่ระบุห้อง
      // ไม่ได้ส่ง k จึงใช้ค่าเริ่มต้นของ chatRequest
      const result = await chatRequest(trimmed, user.user_id, activeSessionId)

      // ถ้า service คืนผลว่ามีข้อผิดพลาด
      if (result.isError) {

        // เพิ่มข้อความผิดพลาดเป็นข้อความฝั่ง bot
        // isError: true ใช้ให้ JSX เลือกหน้าตาแบบข้อความผิดพลาด
        setChatHistory((prev) => [...prev, { role: 'bot', text: result.errorMessage, isError: true }])

        // หยุดส่วนที่เหลือ แต่ finally ยังทำงาน
        return
      }

      // ถ้าสำเร็จ เพิ่มคำตอบและแหล่งอ้างอิงต่อท้ายแชท
      setChatHistory((prev) => [...prev, { role: 'bot', text: result.answer, sources: result.sources }])

      // ถ้าตอนส่งยังไม่มีรหัสห้อง เช่น คำถามแรกของแชทใหม่
      if (!activeSessionId) {

        // เก็บรหัสห้องที่ backend ส่งกลับมา
        // คำถามถัดไปจึงสามารถส่งต่อในห้องเดิมได้
        setActiveSessionId(result.sessionId)

        // แก้: getSessions ไม่รับ user_id แล้ว เช่นเดียวกับด้านบน

        // โหลดรายการห้องใหม่ เพื่อให้ห้องที่เพิ่งสร้างปรากฏในประวัติ
        const updatedSessions = await getSessions()

        // อัปเดตรายการห้องบนหน้าจอ
        setSessions(updatedSessions)

      }

    } catch (err) {

      // จัดการ exception ที่เกิดใน try เช่น ติดต่อ backend ไม่ได้
      console.error(err)

      // เพิ่มข้อความแจ้งปัญหาต่อท้ายรายการ
      setChatHistory((prev) => [
        ...prev, // เก็บข้อความเก่าไว้ครบ
        { role: 'bot', text: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง', isError: true },
      ])

    } finally {

      // ปิดสถานะกำลังส่ง ทั้งกรณีสำเร็จและผิดพลาด
      setIsSending(false)

    }
  } // จบ sendMessage

  // ==========================================================
  // ช่วงที่ 5: ปุ่มส่ง แชทใหม่ และออกจากระบบ
  // ==========================================================

  // ถูกเรียกเมื่อส่งฟอร์ม เช่น กดปุ่มส่งหรือกด Enter ในช่องกรอก
  const handleSend = (e) => {

    // ป้องกันฟอร์มโหลดหน้าใหม่
    e.preventDefault()

    // ส่งข้อความปัจจุบันจาก state ไปให้ sendMessage
    sendMessage(message)

  }

  // เตรียมหน้าจอสำหรับเริ่มแชทใหม่
  const handleNewChat = () => {

    // ล้างข้อความที่กำลังแสดงบนหน้าจอ
    // ไม่ได้ส่งคำขอลบประวัติใน backend
    setChatHistory([])

    // ล้างข้อความที่กำลังพิมพ์
    setMessage('')

    // ยกเลิกการระบุห้องปัจจุบัน
    setActiveSessionId(null)

    // ปิดแถบประวัติ
    setHistoryOpen(false)

    // ให้ช่องกรอกได้รับ focus เพื่อเริ่มพิมพ์ได้
    // ?. ป้องกันการเรียกเมื่อยังไม่มี element
    inputRef.current?.focus()

  }

  // ออกจากระบบ
  const handleLogout = () => {

    // ล้างข้อมูลผู้ใช้ใน AuthContext
    setUser(null)

    // เปลี่ยนไปหน้าล็อกอิน
    navigate('/login')

  }

  // true เมื่อมีข้อความอย่างน้อยหนึ่งรายการ
  // ใช้ตัดสินใจว่าจะแสดงหน้าต้อนรับหรือรายการข้อความ
  const hasMessages = chatHistory.length > 0

  // ถ้ามี username ใช้อักษรแรกเป็นรูปโปรไฟล์
  // toUpperCase = เปลี่ยนอักษรเป็นตัวพิมพ์ใหญ่
  // ถ้าไม่มีชื่อใช้ 'U'
  const avatarLetter = user?.username ? user.username[0].toUpperCase() : 'U'

  // true เมื่อบทบาทเป็น R01
  // ใช้ควบคุมการแสดงปุ่มไปหน้าแอดมิน
  // การตรวจสิทธิ์เข้าถึงข้อมูลจริงยังเป็นหน้าที่ backend
  const isAdmin = user?.role_id === 'R01'

  // ==========================================================
  // ช่วงที่ 6: หน้าจอ JSX
  //
  // className = เชื่อมกับการจัดหน้าตาใน Chat.css
  // { ... } = แทรกค่า JavaScript ลงใน JSX
  // && = ใช้แสดงส่วนหนึ่งเมื่อเงื่อนไขด้านซ้ายเป็นจริง
  // เงื่อนไข ? A : B = ถ้าจริงใช้ A ถ้าเท็จใช้ B
  // ==========================================================

  return (
    // กล่องครอบหน้าแชททั้งหมด
    <div className="chat-page">
      {/* ===== แถบไอคอนลอย ===== */}

      {/* แถบไอคอนควบคุมด้านข้าง */}
      <div className="rail">

        {/* โลโก้อะตอม */}
        <div className="rail-logo"><Atom size={20} color="#0B1150" /></div>

        {/* ปุ่มเปิด/ปิดประวัติ */}
        <div

          // ใช้ template literal ต่อข้อความคลาส
          // ถ้า historyOpen เป็น true เพิ่ม " active"
          className={`rail-btn${historyOpen ? ' active' : ''}`}

          // สลับสถานะเปิด/ปิดจากค่าก่อนหน้า v
          onClick={() => setHistoryOpen((v) => !v)}

          // ข้อความที่เบราว์เซอร์อาจแสดงเมื่อวางเมาส์ค้าง
          title="ประวัติการสนทนา"

        >
          <History size={19} />
        </div>

        {/* คลิกแล้วเตรียมแชทใหม่ */}
        <div className="rail-btn" onClick={handleNewChat} title="สนทนาใหม่">
          <Plus size={19} />
        </div>

        {/* แสดงปุ่มแอดมินเฉพาะเมื่อ isAdmin เป็น true */}
        {isAdmin && (
          <div className="rail-btn" onClick={() => navigate('/admin')} title="ไปหน้า Admin">
            <Settings size={18} />
          </div>
        )}

        {/* element สำหรับให้ CSS จัดพื้นที่ว่างในแถบ */}
        <div className="rail-spacer" />

        {/* กลุ่มรูปผู้ใช้และเมนูย่อย */}
        <div className="rail-avatar-wrap">

          {/* แสดงเมนูย่อยเมื่อ userMenuOpen เป็น true */}
          {userMenuOpen && (
            <div className="rail-user-menu">

              {/* ชื่อบัญชีผู้ใช้ */}
              <div className="rail-user-menu-name">{user?.username}</div>

              {/* ไปหน้าแก้ไขข้อมูลส่วนตัว */}
              <button className="rail-user-menu-item rail-user-menu-item-profile" onClick={() => navigate('/profile')}>
                <User size={14} /> แก้ไขข้อมูลส่วนตัว
              </button>

              {/* เรียก handleLogout เมื่อคลิก */}
              <button className="rail-user-menu-item" onClick={handleLogout}>
                <LogOut size={14} /> ออกจากระบบ
              </button>

            </div>
          )}

          {/* คลิกรูปโปรไฟล์แล้วสลับเปิด/ปิดเมนูผู้ใช้ */}
          <div className="rail-avatar" onClick={() => setUserMenuOpen((v) => !v)} title={user?.username}>
            {avatarLetter}
          </div>

        </div>
      </div>

      {/* ===== ประวัติแบบเลื่อนทับ ===== */}

      {/* แถบประวัติอยู่ใน JSX ตลอด
          แต่เพิ่มคลาส open เมื่อ historyOpen เป็น true
          CSS เป็นผู้กำหนดการแสดงและตำแหน่งของแถบ */}
      <div className={`history-drawer${historyOpen ? ' open' : ''}`}>
        <h3>ประวัติการสนทนา</h3>

        {/* ถ้าไม่มีห้องแชท แสดงข้อความว่าง
            ถ้ามีห้องแชท วนสร้างรายการห้อง */}
        {sessions.length === 0 ? (
          <p className="history-empty">ยังไม่มีประวัติการสนทนา</p>
        ) : (
          sessions.map((session) => (

            // session = ห้องแชทหนึ่งรายการ
            <div

              // key ช่วยให้ React ระบุแต่ละรายการได้
              key={session.session_id}

              // ถ้าเป็นห้องที่เปิดอยู่ เพิ่ม active
              className={session.session_id === activeSessionId ? 'history-item active' : 'history-item'}

              // ส่งรหัสห้องที่คลิกให้ handleSessionClick
              onClick={() => handleSessionClick(session.session_id)}

            >

              {/* แสดงชื่อห้อง ถ้าไม่มีค่าชื่อ ใช้ข้อความสำรอง */}
              {session.session_title || 'สนทนาไม่มีชื่อ'}

            </div>
          ))
        )}
      </div>

      {/* เมื่อเปิดประวัติ แสดงฉากหลังทับพื้นที่อื่น
          คลิกฉากหลังแล้วปิดประวัติ */}
      {historyOpen && <div className="drawer-backdrop" onClick={() => setHistoryOpen(false)} />}

      {/* ===== พื้นที่หลัก ===== */}
      <div className="main">

        {/* ส่วนหัวของพื้นที่สนทนา */}
        <div className="wave-header">
          <div className="wave-top">
            <div>
              <div className="wave-title">Sci Assistant</div>
              <div className="wave-sub">คณะวิทยาศาสตร์ ม.อ. หาดใหญ่</div>
            </div>
            <div className="wave-tag">RAG v1.0</div>
          </div>
        </div>

        {/* ถ้ายังไม่มีข้อความ แสดงหน้าต้อนรับ
            ถ้ามีข้อความ แสดงรายการแชทแทน */}
        {!hasMessages ? (
          <div className="welcome">

            {/* กลุ่มไอคอนสาขาวิทยาศาสตร์ */}
            <div className="welcome-badges">

              {/* map วนรายการไอคอน
                  { title, Icon } = ดึงสองช่องออกจากแต่ละออบเจ็กต์ */}
              {BRANCH_ICONS.map(({ title, Icon }) => (
                <div className="badge" key={title} title={title}>

                  {/* Icon เปลี่ยนไปตาม component ในแต่ละรายการ */}
                  <Icon size={24} color="#0B1150" strokeWidth={1.7} />

                </div>
              ))}
            </div>

            {/* ข้อความต้อนรับ แก้ข้อความหน้าต้อนรับได้ตรงนี้ */}
            <h1>สวัสดี พร้อมตอบทุกคำถามคณะวิทย์</h1>
            <p>ถามเรื่องหลักสูตร อาจารย์ รายวิชา หรือขั้นตอนต่างๆ ได้เลย คำตอบทุกอันอ้างอิงจากเอกสารจริงของคณะ</p>

          </div>
        ) : (

          // พื้นที่รายการข้อความ
          <div className="messages">

            {/* วนสร้างหน้าจอจากแต่ละข้อความ
                msg = ข้อความหนึ่งรายการ
                i = ลำดับใน array เริ่มจาก 0 */}
            {chatHistory.map((msg, i) => (

              // ใช้ลำดับ i เป็น key ตามโค้ดเดิม
              // ถ้าเป็นข้อความผู้ใช้ เพิ่มคลาส user เพื่อจัดตำแหน่ง
              <div key={i} className={`row ${msg.role === 'user' ? 'user' : ''}`}>

                {/* ถ้าไม่ใช่ผู้ใช้ แสดงรูปอะตอมฝั่ง bot */}
                {msg.role !== 'user' && (
                  <div className="avatar bot"><Atom size={14} color="#FFD400" /></div>
                )}

                {/* เลือกหน้าตากล่องตามผู้ส่ง
                    user → bubble-user
                    bot → bubble-bot
                    bot ที่ผิดพลาด → เพิ่ม bubble-error */}
                <div className={msg.role === 'user' ? 'bubble-user' : `bubble-bot${msg.isError ? ' bubble-error' : ''}`}>

                  {/* แสดงข้อความโดยตรง */}
                  {msg.text}

                  {/* แสดงแหล่งอ้างอิงเมื่อครบสามเงื่อนไข:
                      1) ไม่ใช่ข้อความผู้ใช้
                      2) ไม่ใช่ข้อความผิดพลาด
                      3) sources มีอย่างน้อยหนึ่งรายการ */}
                  {msg.role !== 'user' && !msg.isError && msg.sources?.length > 0 && (
                    <div className="sources">
                      <div className="sources-label">แหล่งที่มาของข้อมูล</div>

                      <div className="source-list">

                        {/* วนแหล่งอ้างอิงของคำตอบนี้ */}
                        {msg.sources.map((source) => (
                          <div className="source-item" key={source.document_id}>

                            {/* ลิงก์ไฟล์เอกสารอ้างอิง */}
                            <a
                              className="source-file"

                              // ถ้า download_url เริ่มด้วย http ใช้ URL นั้นทันที
                              // ถ้าไม่ใช่ ให้นำ apiBase มาต่อกับเส้นทางไฟล์
                              // || '' = ถ้าไม่มี download_url ใช้ข้อความว่าง
                              href={source.download_url?.startsWith('http')
                                ? source.download_url
                                : `${AppConfig.apiBase}${source.download_url || ''}`}

                              // เปิดในแท็บหรือหน้าต่างใหม่
                              target="_blank"

                              // ไม่ให้หน้าใหม่เข้าถึง window.opener
                              // และไม่ส่งข้อมูล Referer ผ่านลิงก์นี้
                              rel="noopener noreferrer"

                              // แจ้งเบราว์เซอร์ว่าต้องการดาวน์โหลด
                              // การทำงานจริงขึ้นอยู่กับ URL และการตอบกลับของ server
                              download

                            >

                              {/* ชื่อไฟล์อ้างอิง */}
                              📄 {source.file_name}

                            </a>

                            {/* ถ้ามี URL เว็บต้นทาง ให้แสดงอีกลิงก์ */}
                            {source.source_url && (
                              <a
                                className="source-web"

                                // ใช้ URL เว็บต้นทางจาก backend
                                href={source.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                🌐 หน้าเว็บต้นทาง
                              </a>
                            )}

                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* จบกล่องข้อความ */}
                </div>

                {/* ถ้าเป็นข้อความผู้ใช้ แสดงอักษรย่อของผู้ใช้ */}
                {msg.role === 'user' && <div className="avatar user">{avatarLetter}</div>}

              </div>
            ))}

            {/* ระหว่างรอผล แสดงกล่อง bot พร้อมจุดสามจุด */}
            {isSending && (
              <div className="row">
                <div className="avatar bot"><Atom size={14} color="#FFD400" /></div>
                <div className="bubble-bot">
                  <div className="typing">

                    {/* จุดสามจุด ใช้ CSS กำหนดหน้าตาและการเคลื่อนไหว */}
                    <span className="dot" /><span className="dot" /><span className="dot" />

                  </div>
                </div>
              </div>
            )}

            {/* จุดท้ายแชทที่ messagesEndRef อ้างถึง
                useEffect ใช้ element นี้เป็นเป้าหมายการเลื่อน */}
            <div ref={messagesEndRef} />

          </div>
        )}

        {/* พื้นที่ช่องพิมพ์และปุ่มส่ง */}
        <div className="input-zone">

          {/* ส่งฟอร์มแล้วเรียก handleSend */}
          <form className="input-bar" onSubmit={handleSend}>
            <input

              // ให้ inputRef อ้างถึงช่องนี้ เพื่อสั่ง focus ได้
              ref={inputRef}

              // ช่องข้อความทั่วไป
              type="text"

              // ข้อความตัวอย่างเมื่อช่องยังว่าง
              placeholder="ถามอะไรก็ได้เกี่ยวกับคณะวิทย์..."

              // แสดงค่าจาก state message
              value={message}

              // เมื่อพิมพ์ อัปเดตข้อความใน state
              onChange={(e) => setMessage(e.target.value)}

              // ปิดการกรอกระหว่างกำลังส่ง
              disabled={isSending}

            />

            {/* submit = ส่งฟอร์ม
                ปิดปุ่มเมื่อกำลังส่ง หรือข้อความมีแต่ช่องว่าง/ไม่มีข้อความ
                aria-label = ชื่อปุ่มสำหรับโปรแกรมอ่านหน้าจอ */}
            <button type="submit" className="send-btn" disabled={isSending || !message.trim()} aria-label="ส่งข้อความ">
              <Send size={16} />
            </button>

          </form>

          {/* ข้อความประกอบใต้ช่องพิมพ์ */}
          <p className="disclaimer">คำตอบสร้างจากเอกสารของคณะ อาจมีความคลาดเคลื่อนได้</p>

        </div>
      </div>
    </div>
  ) // จบ JSX

} // จบ component Chat

// เปิดให้ App.jsx import หน้านี้ไปใช้
export default Chat