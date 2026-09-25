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
import "./DocumentChunks.css";

const API_BASE_URL = AppConfig.apiBase;

const extractHeadingPath = (parentText, chunkText) =>
  extractChunkHeading(parentText, chunkText) || null;

function DocumentChunks() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [filterText, setFilterText] = useState("");
  const [activeHeading, setActiveHeading] = useState(null);

  const [doc, setDoc] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

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
    const map = new Map();

    for (const chunk of chunksWithHeading) {
      if (!chunk.headingPath) continue;

      if (!map.has(chunk.headingPath)) {
        map.set(chunk.headingPath, {
          heading: chunk.headingPath,
          chunkId: chunk.chunk_id,
          count: 0,
        });
      }

      map.get(chunk.headingPath).count += 1;
    }

    return Array.from(map.values());
  }, [chunksWithHeading]);

  const headingGroups = useMemo(() => {
    const groups = new Map();

    for (const chunk of visibleChunks) {
      const key = chunk.headingPath || "ไม่มีหัวข้อ";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(chunk);
    }

    return Array.from(groups.entries()).map(([heading, chunks]) => ({
      heading,
      chunks,
      firstChunkId: chunks[0]?.chunk_id,
    }));
  }, [visibleChunks]);

  const jumpToHeading = (chunkId, heading) => {
    const element = document.getElementById(`chunk-${chunkId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setActiveHeading(heading);
  };

  useEffect(() => {
    const handleScroll = () => {
      const firstVisible = visibleChunks.find((chunk) => {
        const el = document.getElementById(`chunk-${chunk.chunk_id}`);
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.top >= 80 && rect.top <= window.innerHeight * 0.45;
      });

      if (firstVisible?.headingPath) {
        setActiveHeading(firstVisible.headingPath);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [visibleChunks]);

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
        <div className="chunks-state">
          <Spinner />
          <p>กำลังโหลดรายละเอียดเอกสาร...</p>
        </div>
      </AdminLayout>
    );
  }

  if (loadError || !doc) {
    return (
      <AdminLayout>
        <div className="chunks-state chunks-state-error">
          <div className="chunks-state-icon">!</div>
          <h2>ไม่สามารถเปิดเอกสารได้</h2>
          <p>{loadError || "ไม่พบเอกสารนี้ในระบบ"}</p>
          <button type="button" className="chunks-primary-btn" onClick={() => navigate("/admin/documents")}>
            ← กลับไปจัดการเอกสาร
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="document-detail-page">
        <header className="document-detail-header">
          <button
            type="button"
            className="document-detail-back"
            onClick={() => navigate("/admin/documents")}
          >
            ← เอกสารทั้งหมด
          </button>

          <div className="document-detail-heading">
            <div className="document-detail-file-icon">
              {(doc.document_type || "file").replace(".", "").toUpperCase()}
            </div>
            <div className="document-detail-title-wrap">
              <p className="chunks-eyebrow">รายละเอียดเอกสาร</p>
              <h1>{doc.document_name}</h1>
              <p className="document-detail-description">
                ดูโครงสร้างและเนื้อหาที่ถูกแบ่งสำหรับการค้นคืนข้อมูลของระบบ
              </p>
            </div>
          </div>

          <div className="document-detail-meta">
            <div className="document-meta-item">
              <span>หมวดหมู่</span>
              <strong>{doc.category_name || "ไม่ระบุหมวดหมู่"}</strong>
            </div>
            <div className="document-meta-item">
              <span>ประเภทไฟล์</span>
              <strong>{(doc.document_type || "file").replace(".", "").toUpperCase()}</strong>
            </div>
            <div className="document-meta-item">
              <span>จำนวน Chunk</span>
              <strong>{doc.chunks.length}</strong>
            </div>
            <div className="document-meta-item">
              <span>หัวข้อ</span>
              <strong>{outline.length}</strong>
            </div>
          </div>
        </header>

        <section className="document-content-header">
          <div>
            <p className="document-content-eyebrow">DOCUMENT CONTENT</p>
            <h2>เนื้อหาในฐานความรู้</h2>
            <p>เนื้อหาด้านล่างคือ Chunk ที่ระบบใช้สำหรับค้นคืนและตอบคำถาม</p>
          </div>

          <div className="document-content-actions">
            <div className="document-search">
              <span aria-hidden="true">⌕</span>
              <input
                type="text"
                placeholder="ค้นหาในเอกสาร..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                aria-label="ค้นหาในเอกสาร"
              />
              {filterText && (
                <button
                  type="button"
                  onClick={() => setFilterText("")}
                  aria-label="ล้างคำค้นหา"
                  title="ล้างคำค้นหา"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </section>

        {filterText.trim() && (
          <div className="document-search-result">
            พบ <strong>{visibleChunks.length}</strong> จาก {chunksWithHeading.length} Chunk
          </div>
        )}

        <div className="document-workspace">
          <aside className="document-outline">
            <div className="document-outline-header">
              <div>
                <span>สารบัญ</span>
                <strong>{outline.length} หัวข้อ</strong>
              </div>
            </div>

            {outline.length === 0 ? (
              <p className="document-outline-empty">เอกสารนี้ยังไม่มีโครงสร้างหัวข้อ</p>
            ) : (
              <nav aria-label="สารบัญเอกสาร">
                {outline.map((item) => {
                  const depth = item.heading.split(" > ").length;
                  const label = item.heading.split(" > ").pop();

                  return (
                    <button
                      type="button"
                      key={item.heading}
                      className={
                        activeHeading === item.heading
                          ? "document-outline-item active"
                          : "document-outline-item"
                      }
                      style={{ paddingLeft: 12 + (depth - 1) * 14 }}
                      onClick={() => jumpToHeading(item.chunkId, item.heading)}
                    >
                      <span>{label}</span>
                      <small>{item.count}</small>
                    </button>
                  );
                })}
              </nav>
            )}
          </aside>

          <main className="document-chunk-content">
            {chunksWithHeading.length === 0 && (
              <div className="document-empty">
                <div className="document-empty-icon">∅</div>
                <h3>ยังไม่มี Chunk</h3>
                <p>เอกสารนี้ยังไม่มีเนื้อหาที่ถูกแบ่งเก็บในฐานความรู้</p>
              </div>
            )}

            {chunksWithHeading.length > 0 && visibleChunks.length === 0 && (
              <div className="document-empty">
                <div className="document-empty-icon">⌕</div>
                <h3>ไม่พบเนื้อหาที่ค้นหา</h3>
                <p>ลองใช้คำค้นหาอื่น หรือดูเนื้อหาทั้งหมดอีกครั้ง</p>
                <button type="button" onClick={() => setFilterText("")}>
                  ล้างคำค้นหา
                </button>
              </div>
            )}

            {headingGroups.map((group) => (
              <section
                key={group.heading}
                className="document-section"
                id={group.firstChunkId ? `section-${group.firstChunkId}` : undefined}
              >
                <div className="document-section-heading">
                  <div className="document-section-line" />
                  <div>
                    <HeadingBreadcrumb path={group.heading === "ไม่มีหัวข้อ" ? null : group.heading} />
                    <p>{group.chunks.length} Chunk</p>
                  </div>
                </div>

                <div className="document-chunk-list">
                  {group.chunks.map((chunk, index) => {
                    const isEditing = editingChunkId === chunk.chunk_id;

                    return (
                      <article
                        key={chunk.chunk_id}
                        id={`chunk-${chunk.chunk_id}`}
                        className={isEditing ? "document-chunk-card editing" : "document-chunk-card"}
                      >
                        <div className="document-chunk-top">
                          <div className="document-chunk-number">
                            <span>CHUNK</span>
                            <strong>{index + 1}</strong>
                          </div>
                          <span className="document-chunk-id">#{chunk.chunk_id}</span>

                          {!isEditing && (
                            <button
                              type="button"
                              className="document-edit-btn"
                              onClick={() => startEdit(chunk)}
                            >
                              ✎ แก้ไข
                            </button>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="document-editor">
                            <textarea
                              value={draftText}
                              onChange={(e) => setDraftText(e.target.value)}
                              disabled={isSaving}
                              autoFocus
                              rows={Math.min(Math.max(draftText.split("\n").length, 6), 18)}
                            />
                            {saveError && <p className="document-save-error">{saveError}</p>}
                            <div className="document-editor-footer">
                              <span>{draftText.length.toLocaleString()} ตัวอักษร</span>
                              <div>
                                <button type="button" className="document-cancel-btn" onClick={cancelEdit} disabled={isSaving}>
                                  ยกเลิก
                                </button>
                                <button type="button" className="document-save-btn" onClick={saveEdit} disabled={isSaving}>
                                  {isSaving && <Spinner />}
                                  {isSaving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="document-chunk-text">
                            <HighlightedText text={chunk.chunk_text} query={filterText} />
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </main>
        </div>
      </div>
    </AdminLayout>
  );
}

export default DocumentChunks;
