import { useState } from 'react'
import AdminSidebar from '../../components/admin/AdminSidebar'
import './Admin.css'

const stats = [
  { label: 'เอกสารทั้งหมด', value: 148 },
  { label: 'Chunks indexed', value: 248 },
  { label: 'คำถามวันนี้', value: 32 },
]

const queryActivity = [
  { day: 'จ', count: 14, date: '19/02/2569' },
  { day: 'อ', count: 22, date: '20/02/2569' },
  { day: 'พ', count: 9, date: '21/02/2569' },
  { day: 'พฤ', count: 17, date: '22/02/2569' },
  { day: 'ศ', count: 25, date: '23/02/2569' },
  { day: 'ส', count: 11, date: '24/02/2569' },
  { day: 'อา', count: 8, date: '25/02/2569' },
  { day: 'จ', count: 12, date: '26/02/2569' },
  { day: 'อ', count: 8, date: '27/02/2569' },
  { day: 'พ', count: 22, date: '28/02/2569' },
  { day: 'พฤ', count: 15, date: '01/03/2569' },
  { day: 'ศ', count: 32, date: '02/03/2569' },
  { day: 'ส', count: 18, date: '03/03/2569' },
  { day: 'อา', count: 10, date: '04/03/2569' },
]

const totalWeeks = Math.ceil(queryActivity.length / 7)

const recentDocs = [
  { name: 'แผนการเรียน ICT 2568.pdf', type: 'PDF', chunks: 6 },
  { name: 'แผนการเรียน ICT 2568.pdf', type: 'PDF', chunks: 6 },
  { name: 'แผนการเรียน ICT 2568.pdf', type: 'PDF', chunks: 6 },
]

function Dashboard() {
  const [weekIndex, setWeekIndex] = useState(0)
  const [selectedDay, setSelectedDay] = useState(null) // index ของแท่งที่เลือกอยู่ (ภายในสัปดาห์ปัจจุบัน)

  const startPos = (totalWeeks - 1 - weekIndex) * 7
  const currentWeekData = queryActivity.slice(startPos, startPos + 7)
  const maxCount = Math.max(...currentWeekData.map((d) => d.count))

  const rangeStart = currentWeekData[0]?.date
  const rangeEnd = currentWeekData[currentWeekData.length - 1]?.date

  const canGoOlder = weekIndex < totalWeeks - 1
  const canGoNewer = weekIndex > 0

  const handleWeekChange = (direction) => {
    setWeekIndex((w) => w + direction)
    setSelectedDay(null) // เปลี่ยนสัปดาห์แล้วเคลียร์แท่งที่เลือกไว้
  }

  const handleBarClick = (index) => {
    setSelectedDay((prev) => (prev === index ? null : index))
  }

  const selected = selectedDay !== null ? currentWeekData[selectedDay] : null

  return (
    <div className="admin-page">
      <AdminSidebar />

      <main className="admin-main">
        <div className="admin-content">
          <h1>ภาพรวมระบบ</h1>

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
                <button
                  className="week-nav-btn"
                  disabled={!canGoOlder}
                  onClick={() => handleWeekChange(1)}
                >
                  ◀
                </button>
                <span className="week-range">
                  {rangeStart} - {rangeEnd}
                </span>
                <button
                  className="week-nav-btn"
                  disabled={!canGoNewer}
                  onClick={() => handleWeekChange(-1)}
                >
                  ▶
                </button>
              </div>
            </div>

            <div className="bar-chart">
              {currentWeekData.map((d, i) => {
                const isSelected = selectedDay === i
                const isMax = d.count === maxCount
                return (
                  <div
                    key={i}
                    className="bar-col"
                    onClick={() => handleBarClick(i)}
                  >
                    {(isSelected || isMax) && (
                      <span className="bar-value">{d.count}</span>
                    )}
                    <div
                      className={
                        isSelected
                          ? 'bar bar-selected'
                          : isMax
                          ? 'bar bar-highlight'
                          : 'bar'
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
                วันที่ {selected.date} ({selected.day}) — คำถามทั้งหมด{' '}
                <strong>{selected.count}</strong> ครั้ง
              </div>
            )}
          </div>

          <div className="panel">
            <p className="panel-title">เอกสารล่าสุด</p>
            <table className="doc-table">
              <tbody>
                {recentDocs.map((doc, i) => (
                  <tr key={i}>
                    <td>{doc.name}</td>
                    <td>
                      <span className="tag tag-pdf">{doc.type}</span>
                    </td>
                    <td>
                      <span className="tag tag-chunks">{doc.chunks} Chunks</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Dashboard