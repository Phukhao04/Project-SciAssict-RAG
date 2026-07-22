import { useAuth } from '../hooks/useAuth'

function Home() {
  const { user, setUser } = useAuth()

  return (
    <div>
      <h1>หน้า Home</h1>
      <p>{user ? `สวัสดี ${user}` : 'ยังไม่ได้ login'}</p>

      {user ? (
        <button onClick={() => setUser(null)}>Logout</button>
      ) : (
        <button onClick={() => setUser('สมชาย')}>Login ปลอม (ทดสอบ)</button>
      )}
    </div>
  )
}

export default Home