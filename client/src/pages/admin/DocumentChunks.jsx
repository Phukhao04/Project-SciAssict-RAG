import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminSidebar from "../../components/admin/AdminSidebar";
import "./Admin.css";

const API_BASE_URL = "http://127.0.0.1:8000";
const PREVIEW_LENGTH = 80;

// parent_text = "heading1 > heading2\n" + chunk_text (ถ้ามี heading)
// หรือ parent_text === chunk_text เฉยๆ (ถ้าไม่มี heading เลย)
// เทียบสองค่านี้แทนที่จะ parse เอง เพราะรูปแบบตรงกับที่ backend
// ประกอบไว้ตอน insert เป๊ะอยู่แล้ว (ดู _merge_chunks_by_heading /
// build_chunks_from_marks ฝั่ง server)
function extractHeadingPath(parentText, chunkText) {
  if (!parentText || parentText === chunkText) return null;
  if (parentText.length > chunkText.length && parentText.endsWith(chunkText)) {
    const prefix = parentText.slice(0, parentText.length - chunkText.length);
    const heading = prefix.replace(/\n$/, "");
    return heading || null;
  }
  return null;
}

function HeadingBreadcrumb({ path }) {
  if (!path) {
    return <span className="tag tag-no-heading">ไม่มีหัวข้อกำกับ</span>;
  }
  const parts = path.split(" > ");
  return (
    <div className="heading-breadcrumb">
      {parts.map((part, i) => (
        <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {i > 0 && <span className="heading-sep">›</span>}
          <span className={`heading-chip heading-chip-${Math.min(i + 1, 3)}`}>{part}</span>
        </span>
      ))}
    </div>
  );
}

function DocumentChunks() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [view, setView] = useState("chunks");
  const [expandedId, setExpandedId] = useState(null);
  const [pendingScrollId, setPendingScrollId] = useState(null);

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

  // เก็บ heading ของแต่ละ chunk ไว้ล่วงหน้า (คำนวณครั้งเดียวตอน doc เปลี่ยน
  // ไม่ต้อง extract ซ้ำทุกครั้งที่ re-render)
  const chunksWithHeading = useMemo(() => {
    if (!doc) return [];
    return doc.chunks.map((c) => ({
      ...c,
      headingPath: extractHeadingPath(c.parent_text, c.chunk_text),
    }));
  }, [doc]);

  // สารบัญ: heading ที่ไม่ซ้ำ เรียงตามลำดับที่เจอครั้งแรกในเอกสาร
  const outline = useMemo(() => {
    const seen = new Set();
    const items = [];
    for (const c of chunksWithHeading) {
      if (c.headingPath && !seen.has(c.headingPath)) {
        seen.add(c.headingPath);
        items.push({ heading: c.headingPath, chunkId: c.chunk_id });
      }
    }
    return items;
  }, [chunksWithHeading]);

  useEffect(() => {
    if (view === "chunks" && pendingScrollId !== null) {
      const el = document.getElementById(`chunk-${pendingScrollId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      // ตั้งเป็น null แค่เคลียร์ trigger ทีเดียวหลัง scroll เสร็จ ไม่ทำให้
      // เกิด cascade render ซ้ำ (พอเป็น null แล้วจะไม่เข้าเงื่อนไข if นี้อีก)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingScrollId(null);
    }
  }, [view, pendingScrollId]);

  const toggleExpand = (chunkId) => {
    setExpandedId((prev) => (prev === chunkId ? null : chunkId));
  };

  const jumpToChunk = (chunkId) => {
    setExpandedId(chunkId);
    setView("chunks");
    setPendingScrollId(chunkId);
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
            <p className="error-message">{loadError || "ไม่พบเอกสารนี้ในระบบ"}</p>
          </div>
        </main>
      </div>
    );
  }

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

          {outline.length > 0 && (
            <div className="outline-panel panel">
              <p className="panel-title">สารบัญเอกสาร ({outline.length} หัวข้อ)</p>
              <ul className="outline-list">
                {outline.map((item) => {
                  const depth = item.heading.split(" > ").length;
                  const label = item.heading.split(" > ").pop();
                  return (
                    <li
                      key={item.chunkId}
                      className="outline-item"
                      style={{ paddingLeft: (depth - 1) * 16 }}
                      onClick={() => jumpToChunk(item.chunkId)}
                    >
                      {label}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {view === "full" && (
            <div className="full-doc-box">
              <span className="tag tag-filename">
                {doc.document_name}.{doc.document_type}
              </span>
              {chunksWithHeading.length === 0 ? (
                <p>เอกสารนี้ยังไม่มี chunk ในระบบ</p>
              ) : (
                <div className="full-doc-structured">
                  {chunksWithHeading.map((c, i) => {
                    const prevHeading = chunksWithHeading[i - 1]?.headingPath ?? undefined;
                    const showHeading = c.headingPath !== prevHeading;
                    return (
                      <div key={c.chunk_id} className="full-doc-section">
                        {showHeading && (
                          <div className="full-doc-heading">
                            <HeadingBreadcrumb path={c.headingPath} />
                          </div>
                        )}
                        <pre className="full-doc-text">{c.chunk_text}</pre>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {view === "chunks" && (
            <div className="chunk-list">
              {chunksWithHeading.length === 0 && <p>เอกสารนี้ยังไม่มี chunk ในระบบ</p>}

              {chunksWithHeading.map((chunk) => {
                const isLong = chunk.chunk_text.length > PREVIEW_LENGTH;
                const preview = isLong
                  ? chunk.chunk_text.slice(0, PREVIEW_LENGTH) + "..."
                  : chunk.chunk_text;

                return (
                  <div key={chunk.chunk_id} id={`chunk-${chunk.chunk_id}`} className="chunk-item">
                    <div className="chunk-heading-row">
                      <HeadingBreadcrumb path={chunk.headingPath} />
                    </div>

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