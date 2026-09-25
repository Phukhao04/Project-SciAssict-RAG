import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../components/admin/AdminLayout";
import AppConfig from "../../config/appConfig";
import "./Admin.css";

const API_BASE_URL = AppConfig.apiBase;

function Dashboard() {
  const navigate = useNavigate();
  const [weekIndex, setWeekIndex] = useState(0);
  const [selectedDay, setSelectedDay] = useState(null);
  const [stats, setStats] = useState([
    { label: "เอกสารทั้งหมด", value: 0 },
    { label: "Chunks indexed", value: 0 },
    { label: "คำถามวันนี้", value: 0 },
  ]);
  const [queryActivity, setQueryActivity] = useState([]);
  const [recentDocs, setRecentDocs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsRes, activityRes, docsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/rag/stats`),
        fetch(`${API_BASE_URL}/api/rag/query-activity`),
        fetch(`${API_BASE_URL}/api/rag/documents`),
      ]);

      if (!statsRes.ok || !activityRes.ok || !docsRes.ok) {
        throw new Error("โหลดข้อมูลภาพรวมไม่สำเร็จ");
      }

      const [statsData, activityData, docsData] = await Promise.all([
        statsRes.json(),
        activityRes.json(),
        docsRes.json(),
      ]);

      setStats([
        { label: "เอกสารทั้งหมด", value: statsData.total_documents ?? 0 },
        { label: "Chunks indexed", value: statsData.total_chunks ?? 0 },
        { label: "คำถามวันนี้", value: statsData.questions_today ?? 0 },
      ]);
      setQueryActivity(Array.isArray(activityData) ? activityData : []);
      setRecentDocs(Array.isArray(docsData) ? docsData.slice(0, 5) : []);
      setLoadError("");
      setWeekIndex(0);
      setSelectedDay(null);
    } catch (err) {
      console.error(err);
      setLoadError(err.message || "ไม่สามารถโหลดข้อมูลภาพรวมได้");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const totalWeeks = Math.ceil(queryActivity.length / 7);
  const startPos = Math.max(0, (totalWeeks - 1 - weekIndex) * 7);
  const currentWeekData = queryActivity.slice(startPos, startPos + 7);
  const maxCount = Math.max(1, ...currentWeekData.map((d) => Number(d.count) || 0));
  const rangeStart = currentWeekData[0]?.date;
  const rangeEnd = currentWeekData[currentWeekData.length - 1]?.date;
  const canGoOlder = weekIndex < totalWeeks - 1;
  const canGoNewer = weekIndex > 0;
  const selected = selectedDay !== null ? currentWeekData[selectedDay] : null;

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="admin-loading-state" aria-live="polite">
          <span className="admin-spinner" aria-hidden="true" />
          <div>
            <strong>กำลังโหลดภาพรวม</strong>
            <p>กำลังดึงข้อมูลจากฐานความรู้...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <section className="dashboard-page">
        <div className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">ภาพรวมระบบ</p>
            <h1>Dashboard</h1>
            <p className="dashboard-description">
              ภาพรวมเอกสาร การจัดทำดัชนี และการใช้งาน Sci Assistant
            </p>
          </div>
          <button
            type="button"
            className="dashboard-primary-btn"
            onClick={() => navigate("/admin/upload")}
          >
            ＋ เพิ่มเอกสาร
          </button>
        </div>

        {loadError && (
          <div className="dashboard-error" role="alert">
            <strong>โหลดข้อมูลไม่สำเร็จ</strong>
            <span>{loadError}</span>
            <button type="button" onClick={loadDashboard}>ลองใหม่</button>
          </div>
        )}

        <div className="dashboard-stat-grid">
          {stats.map((stat) => (
            <div key={stat.label} className="dashboard-stat-card">
              <span>{stat.label}</span>
              <strong>{Number(stat.value).toLocaleString("th-TH")}</strong>
            </div>
          ))}
        </div>

        <div className="dashboard-grid">
          <section className="dashboard-panel dashboard-activity-panel">
            <div className="dashboard-panel-header">
              <div>
                <h2>การใช้งาน Query</h2>
                <p>จำนวนคำถามที่ระบบได้รับในแต่ละวัน</p>
              </div>
              {currentWeekData.length > 0 && (
                <div className="dashboard-week-nav">
                  <button
                    type="button"
                    disabled={!canGoOlder}
                    onClick={() => {
                      setWeekIndex((w) => w + 1);
                      setSelectedDay(null);
                    }}
                    aria-label="ดูสัปดาห์ก่อนหน้า"
                  >‹</button>
                  <span>{rangeStart} – {rangeEnd}</span>
                  <button
                    type="button"
                    disabled={!canGoNewer}
                    onClick={() => {
                      setWeekIndex((w) => w - 1);
                      setSelectedDay(null);
                    }}
                    aria-label="ดูสัปดาห์ถัดไป"
                  >›</button>
                </div>
              )}
            </div>

            {currentWeekData.length === 0 ? (
              <div className="dashboard-empty">ยังไม่มีข้อมูลการใช้งาน</div>
            ) : (
              <>
                <div className="dashboard-chart" aria-label="กราฟจำนวน Query รายวัน">
                  {currentWeekData.map((d, i) => {
                    const count = Number(d.count) || 0;
                    const isSelected = selectedDay === i;
                    return (
                      <button
                        type="button"
                        key={`${d.date}-${i}`}
                        className={isSelected ? "dashboard-bar-column selected" : "dashboard-bar-column"}
                        onClick={() => setSelectedDay((prev) => prev === i ? null : i)}
                        aria-label={`${d.date}: ${count} คำถาม`}
                      >
                        <span className="dashboard-bar-value">{isSelected ? count : ""}</span>
                        <span
                          className="dashboard-bar"
                          style={{ height: `${Math.max(4, (count / maxCount) * 100)}%` }}
                        />
                        <span className="dashboard-bar-label">{d.day}</span>
                      </button>
                    );
                  })}
                </div>

                {selected && (
                  <div className="dashboard-chart-detail">
                    {selected.date} ({selected.day}) · <strong>{selected.count}</strong> คำถาม
                  </div>
                )}
              </>
            )}
          </section>

          <section className="dashboard-panel dashboard-doc-panel">
            <div className="dashboard-panel-header">
              <div>
                <h2>เอกสารล่าสุด</h2>
                <p>เอกสารที่เพิ่มเข้าสู่ฐานความรู้ล่าสุด</p>
              </div>
              <button
                type="button"
                className="dashboard-text-btn"
                onClick={() => navigate("/admin/documents")}
              >
                ดูทั้งหมด →
              </button>
            </div>

            {recentDocs.length === 0 ? (
              <div className="dashboard-empty">
                <span>ยังไม่มีเอกสารในระบบ</span>
                <button type="button" onClick={() => navigate("/admin/upload")}>
                  เพิ่มเอกสาร
                </button>
              </div>
            ) : (
              <div className="dashboard-doc-list">
                {recentDocs.map((doc) => (
                  <button
                    type="button"
                    className="dashboard-doc-item"
                    key={doc.document_id}
                    onClick={() => navigate(`/admin/documents/${doc.document_id}`)}
                  >
                    <span className="dashboard-doc-icon">
                      {(doc.document_type || "").replace(".", "").toUpperCase() || "DOC"}
                    </span>
                    <span className="dashboard-doc-info">
                      <strong title={doc.document_name}>{doc.document_name}</strong>
                      <small>
                        {doc.category_name || "ไม่ระบุหมวดหมู่"} · {doc.chunks_count ?? 0} Chunks
                      </small>
                    </span>
                    <span className="dashboard-doc-arrow">→</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </AdminLayout>
  );
}

export default Dashboard;