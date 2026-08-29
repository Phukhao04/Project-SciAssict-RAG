import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminLayout from "../../components/admin/AdminLayout";
import HeadingBreadcrumb from "../../components/admin/HeadingBreadcrumb";
import HighlightedText from "../../components/admin/HighlightedText";
import Spinner from "../../components/common/Spinner";
import AppConfig from "../../config/appConfig";
import { authHeaders } from "../../utils/authHeaders";
import { extractChunkHeading } from "../../utils/chunkHeading";
import "./Admin.css";

const API_BASE_URL = AppConfig.apiBase;

// wrapper: util คืน "" เมื่อไม่มี heading แต่โค้ดหน้านี้เช็ก `=== null` อยู่หลายจุด
const extractHeadingPath = (parentText, chunkText) =>
  extractChunkHeading(parentText, chunkText) || null;

function DocumentChunks() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [view, setView] = useState("chunks");
  const [pendingScrollId, setPendingScrollId] = useState(null);
  const [filterText, setFilterText] = useState("");

  const [doc, setDoc] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // แก้ไขได้ทีละ chunk เท่านั้น (ไม่รองรับแก้พร้อมกันหลายอันพร้อมกัน
  // เพื่อไม่ให้สับสนว่า draft ไหนยังไม่ได้บันทึก)
  const [editingChunkId, setEditingChunkId] = useState(null);
  const [draftText, setDraftText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const loadDocument = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/rag/documents/${id}`, {
        headers: { ...authHeaders() },
      });
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

  const chunksWithHeading = useMemo(() => {
    if (!doc) return [];
    return doc.chunks.map((c) => ({
      ...c,
      headingPath: extractHeadingPath(c.parent_text, c.chunk_text),
    }));
  }, [doc]);

  const visibleChunks = useMemo(() => {
    const needle = filterText.trim().toLowerCase();
    if (!needle) return chunksWithHeading;
    return chunksWithHeading.filter(
      (c) =>
        c.chunk_text.toLowerCase().includes(needle) ||
        (c.headingPath && c.headingPath.toLowerCase().includes(needle))
    );
  }, [chunksWithHeading, filterText]);

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingScrollId(null);
    }
  }, [view, pendingScrollId]);

  const jumpToChunk = (chunkId) => {
    setView("chunks");
    setPendingScrollId(chunkId);
  };

  const startEdit = (chunk) => {
    setEditingChunkId(chunk.chunk_id);
    setDraftText(chunk.chunk_text);
    setSaveError("");
  };

  const cancelEdit = () => {
    if (isSaving) return;
    setEditingChunkId(null);
    setDraftText("");
    setSaveError("");
  };

  const saveEdit = async () => {
    if (isSaving) return;
    if (!draftText.trim()) {
      setSaveError("เนื้อหาต้องไม่ว่างเปล่า");
      return;
    }
    setIsSaving(true);
    setSaveError("");

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/rag/documents/${id}/chunks/${editingChunkId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ chunk_text: draftText }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "บันทึกไม่สำเร็จ กรุณาลองใหม่");
      }
      const updated = await res.json();

      setDoc((prev) => ({
        ...prev,
        chunks: prev.chunks.map((c) =>
          c.chunk_id === editingChunkId
            ? { ...c, chunk_text: updated.chunk_text, parent_text: updated.parent_text }
            : c
        ),
      }));
      setEditingChunkId(null);
      setDraftText("");
    } catch (err) {
      console.error(err);
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <p>กำลังโหลดข้อมูลเอกสาร...</p>
      </AdminLayout>
    );
  }

  if (loadError || !doc) {
    return (
      <AdminLayout>
        <button className="back-link" onClick={() => navigate("/admin/documents")}>
          &lt; กลับ
        </button>
        <p className="error-message">{loadError || "ไม่พบเอกสารนี้ในระบบ"}</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
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

      <div className="search-input-wrap doc-search-wrap">
        <input
          type="text"
          className="search-input mark-search"
          placeholder="ค้นหาข้อความในเอกสาร..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
        {filterText && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={() => setFilterText("")}
            title="ล้างคำค้นหา"
            aria-label="ล้างคำค้นหา"
          >
            ✕
          </button>
        )}
      </div>
      {filterText.trim() && view === "chunks" && (
        <p className="filter-hint">
          พบ {visibleChunks.length} จาก {chunksWithHeading.length} chunk
        </p>
      )}

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
                    <pre className="full-doc-text">
                      <HighlightedText text={c.chunk_text} query={filterText} />
                    </pre>
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
          {chunksWithHeading.length > 0 && visibleChunks.length === 0 && (
            <div className="empty-state">
              <p className="empty-state-title">
                ไม่พบข้อความที่ตรงกับ &quot;{filterText}&quot;
              </p>
              <button
                type="button"
                className="empty-state-clear-btn"
                onClick={() => setFilterText("")}
              >
                ล้างคำค้นหา
              </button>
            </div>
          )}

          {visibleChunks.map((chunk) => {
            const isEditing = editingChunkId === chunk.chunk_id;
            return (
              <div key={chunk.chunk_id} id={`chunk-${chunk.chunk_id}`} className="chunk-item">
                <div className="chunk-heading-row">
                  <HeadingBreadcrumb path={chunk.headingPath} />
                </div>

                <div className="chunk-card-header">
                  <span className="tag tag-chunkid">chunk_{chunk.chunk_id}</span>
                  {!isEditing && (
                    <button
                      type="button"
                      className="chunk-edit-btn"
                      onClick={() => startEdit(chunk)}
                    >
                      แก้ไข
                    </button>
                  )}
                </div>

                <div className="chunk-detail-static">
                  {isEditing ? (
                    <>
                      <textarea
                        className="chunk-edit-textarea"
                        value={draftText}
                        onChange={(e) => setDraftText(e.target.value)}
                        rows={Math.min(Math.max(draftText.split("\n").length, 3), 16)}
                        disabled={isSaving}
                        autoFocus
                      />
                      {saveError && <p className="error-message">{saveError}</p>}
                      <div className="chunk-edit-actions">
                        <button
                          type="button"
                          className="switch-page-btn"
                          onClick={cancelEdit}
                          disabled={isSaving}
                        >
                          ยกเลิก
                        </button>
                        <button
                          type="button"
                          className="upload-btn chunk-save-btn"
                          onClick={saveEdit}
                          disabled={isSaving}
                        >
                          {isSaving && <Spinner />}
                          {isSaving ? "กำลังบันทึก..." : "บันทึก"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <pre className="full-doc-text">
                      <HighlightedText text={chunk.chunk_text} query={filterText} />
                    </pre>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}

export default DocumentChunks;