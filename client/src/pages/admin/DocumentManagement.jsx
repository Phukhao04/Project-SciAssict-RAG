import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../components/admin/AdminLayout";
import AppConfig from "../../config/appConfig";
import { authHeaders } from "../../utils/authHeaders";
import "./Admin.css";

const API_BASE_URL = AppConfig.apiBase;

function formatThaiDate(isoString) {
  if (!isoString) return "-";

  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "-";

  return d.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getFileType(type = "") {
  return type.replace(".", "").toUpperCase() || "FILE";
}

function DocumentManagement() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const loadDocuments = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/rag/documents`, {
        headers: { ...authHeaders() },
      });

      if (res.status === 401) {
        throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
      }

      if (res.status === 403) {
        throw new Error("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
      }

      if (!res.ok) {
        throw new Error("โหลดรายการเอกสารไม่สำเร็จ");
      }

      const data = await res.json();
      setDocuments(Array.isArray(data) ? data : []);
      setLoadError("");
    } catch (err) {
      console.error(err);
      setLoadError(err.message || "ไม่สามารถโหลดรายการเอกสารได้ กรุณาลองใหม่");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleRetry = () => {
    setIsLoading(true);
    loadDocuments();
  };

  const categories = useMemo(
    () =>
      [...new Set(
        documents
          .map((doc) => doc.category_name)
          .filter(Boolean)
      )].sort((a, b) => a.localeCompare(b, "th")),
    [documents]
  );

  const filteredDocs = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return documents.filter((doc) => {
      const matchesSearch =
        !keyword ||
        String(doc.document_name || "").toLowerCase().includes(keyword);

      const matchesCategory =
        categoryFilter === "all" ||
        doc.category_name === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [documents, search, categoryFilter]);

  const totalChunks = useMemo(
    () =>
      documents.reduce(
        (sum, doc) => sum + (Number(doc.chunks_count) || 0),
        0
      ),
    [documents]
  );

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("all");
  };

  const handleDelete = async (docId, docName) => {
    const confirmed = window.confirm(
      `ต้องการลบเอกสาร "${docName}" ใช่หรือไม่?\n\nการลบเอกสารจะไม่สามารถย้อนกลับได้`
    );

    if (!confirmed) return;

    setDeletingId(docId);

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/rag/documents/${docId}`,
        {
          method: "DELETE",
          headers: { ...authHeaders() },
        }
      );

      if (res.status === 401) {
        throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
      }

      if (res.status === 403) {
        throw new Error("คุณไม่มีสิทธิ์ลบเอกสาร");
      }

      if (!res.ok) {
        throw new Error("ลบเอกสารไม่สำเร็จ");
      }

      setDocuments((prev) =>
        prev.filter((doc) => doc.document_id !== docId)
      );
    } catch (err) {
      console.error(err);
      window.alert(err.message || "ลบเอกสารไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setDeletingId(null);
    }
  };

  const hasFilters = search.trim() !== "" || categoryFilter !== "all";

  return (
    <AdminLayout>
      <section className="document-management-page" aria-labelledby="document-page-title">
        <div className="document-page-header">
          <div>
            <p className="document-page-eyebrow">ฐานความรู้</p>
            <h1 id="document-page-title">จัดการเอกสาร</h1>
            <p className="document-page-description">
              ค้นหา ดูรายละเอียด และจัดการเอกสารที่อยู่ในฐานความรู้ของ Sci Assistant
            </p>
          </div>

          <button
            type="button"
            className="document-add-btn"
            onClick={() => navigate("/admin/upload")}
          >
            <span aria-hidden="true">＋</span>
            เพิ่มเอกสาร
          </button>
        </div>

        {!isLoading && !loadError && (
          <div className="document-overview" aria-label="สรุปเอกสาร">
            <div className="document-overview-item">
              <span>เอกสารทั้งหมด</span>
              <strong>{documents.length}</strong>
            </div>
            <div className="document-overview-item">
              <span>หมวดหมู่</span>
              <strong>{categories.length}</strong>
            </div>
            <div className="document-overview-item">
              <span>Chunks ทั้งหมด</span>
              <strong>{totalChunks.toLocaleString("th-TH")}</strong>
            </div>
          </div>
        )}

        {loadError && (
          <div className="document-state document-error-state" role="alert">
            <div className="document-state-icon" aria-hidden="true">!</div>
            <div>
              <strong>โหลดรายการเอกสารไม่สำเร็จ</strong>
              <p>{loadError}</p>
              <button type="button" onClick={handleRetry}>
                ลองใหม่
              </button>
            </div>
          </div>
        )}

        {!loadError && (
          <>
            <div className="document-toolbar">
              <div className="document-search">
                <span className="document-search-icon" aria-hidden="true">⌕</span>
                <input
                  type="search"
                  aria-label="ค้นหาเอกสาร"
                  placeholder="ค้นหาจากชื่อเอกสาร..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    type="button"
                    className="document-search-clear"
                    aria-label="ล้างคำค้นหา"
                    onClick={() => setSearch("")}
                  >
                    ×
                  </button>
                )}
              </div>

              <label className="document-filter">
                <span>หมวดหมู่</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">ทุกหมวดหมู่</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              {hasFilters && (
                <button
                  type="button"
                  className="document-clear-filter"
                  onClick={clearFilters}
                >
                  ล้างตัวกรอง
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="document-state" aria-live="polite">
                <span className="document-spinner" aria-hidden="true" />
                <div>
                  <strong>กำลังโหลดเอกสาร</strong>
                  <p>กำลังดึงรายการเอกสารจากฐานความรู้...</p>
                </div>
              </div>
            ) : documents.length === 0 ? (
              <div className="document-empty-state">
                <div className="document-empty-icon" aria-hidden="true">□</div>
                <h2>ยังไม่มีเอกสารในฐานความรู้</h2>
                <p>เพิ่มเอกสารแรกเพื่อเริ่มสร้างฐานความรู้ให้ Sci Assistant</p>
                <button
                  type="button"
                  className="document-empty-btn"
                  onClick={() => navigate("/admin/upload")}
                >
                  เพิ่มเอกสาร
                </button>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="document-empty-state compact">
                <div className="document-empty-icon" aria-hidden="true">⌕</div>
                <h2>ไม่พบเอกสารที่ตรงกับตัวกรอง</h2>
                <p>ลองเปลี่ยนคำค้นหาหรือเลือกหมวดหมู่อื่น</p>
                <button
                  type="button"
                  className="document-empty-btn secondary"
                  onClick={clearFilters}
                >
                  ล้างตัวกรอง
                </button>
              </div>
            ) : (
              <div className="document-table-card">
                <div className="document-table-meta">
                  <span>
                    แสดง <strong>{filteredDocs.length}</strong> จาก {documents.length} เอกสาร
                  </span>
                </div>

                <div className="document-table-wrap">
                  <table className="document-table">
                    <thead>
                      <tr>
                        <th>เอกสาร</th>
                        <th>ประเภท</th>
                        <th>หมวดหมู่</th>
                        <th>Chunks</th>
                        <th>วันที่เพิ่ม</th>
                        <th className="document-action-header">จัดการ</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredDocs.map((doc) => (
                        <tr key={doc.document_id}>
                          <td>
                            <div className="document-name-cell">
                              <div className="document-file-icon" aria-hidden="true">
                                {getFileType(doc.document_type) === "PDF" ? "PDF" : "DOC"}
                              </div>
                              <div className="document-name-content">
                                <strong title={doc.document_name}>
                                  {doc.document_name}
                                </strong>
                                <span>ID: {doc.document_id}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="document-type-badge">
                              {getFileType(doc.document_type)}
                            </span>
                          </td>
                          <td>
                            <span className="document-category-badge">
                              {doc.category_name || "ไม่ระบุหมวดหมู่"}
                            </span>
                          </td>
                          <td>
                            <span className="document-chunk-count">
                              {(Number(doc.chunks_count) || 0).toLocaleString("th-TH")}
                            </span>
                          </td>
                          <td className="document-date">
                            {formatThaiDate(doc.upload_date)}
                          </td>
                          <td>
                            <div className="document-actions">
                              <button
                                type="button"
                                className="document-view-btn"
                                onClick={() =>
                                  navigate(`/admin/documents/${doc.document_id}`)
                                }
                              >
                                ดูรายละเอียด
                              </button>
                              <button
                                type="button"
                                className="document-delete-btn"
                                disabled={deletingId === doc.document_id}
                                onClick={() =>
                                  handleDelete(doc.document_id, doc.document_name)
                                }
                                aria-label={`ลบ ${doc.document_name}`}
                              >
                                {deletingId === doc.document_id ? "กำลังลบ..." : "ลบ"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </AdminLayout>
  );
}

export default DocumentManagement;
