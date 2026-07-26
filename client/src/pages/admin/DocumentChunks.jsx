import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminSidebar from "../../components/admin/AdminSidebar";
import "./Admin.css";

const API_BASE_URL = "http://127.0.0.1:8000";
const PREVIEW_LENGTH = 80;

function DocumentChunks() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [view, setView] = useState("chunks");
  const [expandedId, setExpandedId] = useState(null);

  const [doc, setDoc] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadDocument = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/rag/documents/${id}`);
      if (res.status === 404) throw new Error("ไม่พบเอกสารนี้ในระบบ");
      if (!res.ok) throw new Error("โหลดข้อมูลเอกสารไม่สำเร็จ");
      const data = await res.json();
      setDoc(data);
      setLoadError("");
    } catch (err) {
      console.error(err);
      setLoadError(err.message || "โหลดข้อมูลเอกสารไม่สำเร็จ");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadDocument ตั้ง setState หลัง await เท่านั้น
    loadDocument();
  }, [loadDocument]);

  const toggleExpand = (chunkId) => {
    setExpandedId((prev) => (prev === chunkId ? null : chunkId));
  };

  if (isLoading) {
    return (
      <div className="admin-page">
        <AdminSidebar />
        <main className="admin-main">
          <div className="admin-content">
            <p>กำลังโหลดข้อมูลเอกสาร...</p>
          </div>
        </main>
      </div>
    );
  }

  if (loadError || !doc) {
    return (
      <div className="admin-page">
        <AdminSidebar />
        <main className="admin-main">
          <div className="admin-content">
            <button className="back-link" onClick={() => navigate("/admin/documents")}>
              &lt; กลับ
            </button>
            <p className="error-message" style={{ color: "red" }}>
              {loadError || "ไม่พบเอกสารนี้ในระบบ"}
            </p>
          </div>
        </main>
      </div>
    );
  }

  // ต่อ chunk_text ทั้งหมดเข้าด้วยกันเพื่อประมาณ "ไฟล์เต็ม"
  // หมายเหตุ: นี่คือข้อความที่ประกอบขึ้นจาก chunks ไม่ใช่ text ต้นฉบับก่อน chunking
  // เพราะระบบยังไม่ได้เก็บ full text ของเอกสารแยกไว้
  const reconstructedText = doc.chunks.map((c) => c.chunk_text).join("\n\n---\n\n");

  return (
    <div className="admin-page">
      <AdminSidebar />

      <main className="admin-main">
        <div className="admin-content">
          <div className="chunks-header">
            <button className="back-link" onClick={() => navigate("/admin/documents")}>
              &lt; {doc.document_name}
            </button>
          </div>

          <div className="view-tabs">
            <button
              className={view === "full" ? "view-tab active" : "view-tab"}
              onClick={() => setView("full")}
            >
              ไฟล์เต็ม
            </button>
            <button
              className={view === "chunks" ? "view-tab active" : "view-tab"}
              onClick={() => setView("chunks")}
            >
              Chunks ({doc.chunks.length})
            </button>
          </div>

          {view === "full" && (
            <div className="full-doc-box">
              <span className="tag tag-filename">
                {doc.document_name}.{doc.document_type}
              </span>
              {doc.chunks.length === 0 ? (
                <p>เอกสารนี้ยังไม่มี chunk ในระบบ</p>
              ) : (
                <pre className="full-doc-text">{reconstructedText}</pre>
              )}
            </div>
          )}

          {view === "chunks" && (
            <div className="chunk-list">
              {doc.chunks.length === 0 && <p>เอกสารนี้ยังไม่มี chunk ในระบบ</p>}

              {doc.chunks.map((chunk) => {
                const isLong = chunk.chunk_text.length > PREVIEW_LENGTH;
                const preview = isLong
                  ? chunk.chunk_text.slice(0, PREVIEW_LENGTH) + "..."
                  : chunk.chunk_text;

                return (
                  <div key={chunk.chunk_id} className="chunk-item">
                    <div className="chunk-row" onClick={() => toggleExpand(chunk.chunk_id)}>
                      <span className="tag tag-chunkid">chunk_{chunk.chunk_id}</span>
                      <span className="chunk-preview">{preview}</span>
                      <span className="chunk-caret">
                        {expandedId === chunk.chunk_id ? "▲" : "▼"}
                      </span>
                    </div>

                    {expandedId === chunk.chunk_id && (
                      <div className="chunk-detail">
                        <pre className="full-doc-text">{chunk.chunk_text}</pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default DocumentChunks;