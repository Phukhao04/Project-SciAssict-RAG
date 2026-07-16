import AdminSidebar from '../../components/admin/AdminSidebar'
import './Admin.css'

const stats = [
  { label: 'เอกสารทั้งหมด', value: 148 },
  { label: 'Chunks indexed', value: 248 },
  { label: 'คำถามวันนี้', value: 32 },
]

const queryActivity = [
  { day: 'จ', count: 12 },
  { day: 'อ', count: 8 },
  { day: 'พ', count: 22 },
  { day: 'พฤ', count: 15 },
  { day: 'ศ', count: 28 },
  { day: 'ส', count: 18 },
  { day: 'อา', count: 10 },
]

const recentDocs = [
  { name: 'แผนการเรียน ICT 2568.pdf', type: 'PDF', chunks: 6 },
  { name: 'แผนการเรียน ICT 2568.pdf', type: 'PDF', chunks: 6 },
  { name: 'แผนการเรียน ICT 2568.pdf', type: 'PDF', chunks: 6 },
]

function Dashboard() {
  const maxCount = Math.max(...queryActivity.map((d) => d.count))

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
            <p className="panel-title">Query Activity — 7 วันล่าสุด</p>
            <div className="bar-chart">
              {queryActivity.map((d, i) => (
                <div key={i} className="bar-col">
                  <div
                    className="bar"
                    style={{ height: `${(d.count / maxCount) * 100}%` }}
                  />
                  <span className="bar-label">{d.day}</span>
                </div>
              ))}
            </div>
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