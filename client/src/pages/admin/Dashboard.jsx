import { useState, useEffect, useCallback } from 'react'
import AdminSidebar from '../../components/admin/AdminSidebar'

import './Admin.css'

const API_BASE_URL = 'http://127.0.0.1:8000'

function Dashboard() {
  const [weekIndex, setWeekIndex] = useState(0)
  const [selectedDay, setSelectedDay] = useState(null)

  const [stats, setStats] = useState([
    { label: 'เอกสารทั้งหมด', value: 0 },
    { label: 'Chunks indexed', value: 0 },
    { label: 'คำถามวันนี้', value: 0 },
  ])
  const [queryActivity, setQueryActivity] = useState([])
  const [recentDocs, setRecentDocs] = useState([])

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const loadDashboard = useCallback(async () => {
    try {
      const [statsRes, activityRes, docsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/rag/stats`),
        fetch(`${API_BASE_URL}/api/rag/query-activity`),
        fetch(`${API_BASE_URL}/api/rag/documents`),
      ])

      if (!statsRes.ok || !activityRes.ok || !docsRes.ok) {
        throw new Error('โหลดข้อมูล dashboard ไม่สำเร็จ')
      }

      const statsData = await statsRes.json()
      const activityData = await activityRes.json()
      const docsData = await docsRes.json()

      setStats([
        { label: 'เอกสารทั้งหมด', value: statsData.total_documents },
        { label: 'Chunks indexed', value: statsData.total_chunks },
        { label: 'คำถามวันนี้', value: statsData.questions_today },
      ])
      setQueryActivity(activityData)
      setRecentDocs(docsData.slice(0, 3)) // เอกสารล่าสุดแค่ 3 อันแรก (docs sort ตาม upload_date DESC จาก backend อยู่แล้ว)
      setLoadError('')
    } catch (err) {
      console.error(err)
      setLoadError('ไม่สามารถโหลดข้อมูลภาพรวมได้ กรุณาลองใหม่')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadDashboard ตั้ง setState หลัง await เท่านั้น
    loadDashboard()
  }, [loadDashboard])

  const totalWeeks = Math.ceil(queryActivity.length / 7)
  const startPos = (totalWeeks - 1 - weekIndex) * 7
  const currentWeekData = queryActivity.slice(startPos, startPos + 7)
  const maxCount = Math.max(1, ...currentWeekData.map((d) => d.count)) // กัน NaN ตอนสัปดาห์นั้นไม่มีคำถามเลย

  const rangeStart = currentWeekData[0]?.date
  const rangeEnd = currentWeekData[currentWeekData.length - 1]?.date

  const canGoOlder = weekIndex < totalWeeks - 1
  const canGoNewer = weekIndex > 0

  const handleWeekChange = (direction) => {
    setWeekIndex((w) => w + direction)
    setSelectedDay(null)
  }

  const handleBarClick = (index) => {
    setSelectedDay((prev) => (prev === index ? null : index))
  }

  const selected = selectedDay !== null ? currentWeekData[selectedDay] : null

  if (isLoading) {
    return (
      <div className="admin-page">
        <AdminSidebar />
        <main className="admin-main">
          <div className="admin-content">
            <p>กำลังโหลดข้อมูล...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <AdminSidebar />

      <main className="admin-main">
        <div className="admin-content">
          <h1>ภาพรวมระบบ</h1>
          {loadError && (
            <p className="error-message" style={{ color: 'red' }}>
              {loadError}
            </p>
          )}

          <div className="stat-grid">
            {stats.map((stat, i) => (
              <div key={i} className="stat-card">
                <p className="stat-label">{stat.label}</p>
                <p className="stat-value">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="panel">
            <div className="panel-header">
              <p className="panel-title">Query Activity</p>

              <div className="week-nav">
                <button className="week-nav-btn" disabled={!canGoOlder} onClick={() => handleWeekChange(1)}>
                  ◀
                </button>
                <span className="week-range">
                  {rangeStart} - {rangeEnd}
                </span>
                <button className="week-nav-btn" disabled={!canGoNewer} onClick={() => handleWeekChange(-1)}>
                  ▶
                </button>
              </div>
            </div>

            <div className="bar-chart">
              {currentWeekData.map((d, i) => {
                const isSelected = selectedDay === i
                const isMax = d.count === maxCount && d.count > 0
                return (
                  <div key={i} className="bar-col" onClick={() => handleBarClick(i)}>
                    {(isSelected || isMax) && <span className="bar-value">{d.count}</span>}
                    <div
                      className={
                        isSelected ? 'bar bar-selected' : isMax ? 'bar bar-highlight' : 'bar'
                      }
                      style={{ height: `${(d.count / maxCount) * 100}%` }}
                    />
                    <span className="bar-label">{d.day}</span>
                  </div>
                )
              })}
            </div>

            {selected && (
              <div className="bar-detail">
                วันที่ {selected.date} ({selected.day}) — คำถามทั้งหมด <strong>{selected.count}</strong> ครั้ง
              </div>
            )}
          </div>

          <div className="panel">
            <p className="panel-title">เอกสารล่าสุด</p>
            <table className="doc-table">
              <tbody>
                {recentDocs.length === 0 ? (
                  <tr>
                    <td>ยังไม่มีเอกสารในระบบ</td>
                  </tr>
                ) : (
                  recentDocs.map((doc) => (
                    <tr key={doc.document_id}>
                      <td>{doc.document_name}</td>
                      <td>
                        <span className="tag tag-pdf">{doc.document_type.toUpperCase()}</span>
                      </td>
                      <td>
                        <span className="tag tag-chunks">{doc.chunks_count} Chunks</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Dashboard