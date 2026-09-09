import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../components/admin/AdminLayout";
import AppConfig from "../../config/appConfig";
import { authHeaders } from "../../utils/authHeaders";
import "./Admin.css";

const API_BASE_URL = AppConfig.apiBase;

function formatThaiDate(isoString) {
  const d = new Date(isoString);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function DocumentManagement() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [deletingId, setDeletingId] = useState(null);

  const loadDocuments = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/rag/documents`, {
        headers: { ...authHeaders() },
      });
      if (res.status === 401) throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
      if (res.status === 403) throw new Error("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
      if (!res.ok) throw new Error("โหลดรายการเอกสารไม่สำเร็จ");
      const data = await res.json();
      setDocuments(data);
      setLoadError("");
    } catch (err) {
      console.error(err);
      setLoadError(err.message || "ไม่สามารถโหลดรายการเอกสารได้ กรุณาลองใหม่");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadDocuments ตั้ง setState หลัง await เท่านั้น
    loadDocuments();
  }, [loadDocuments]);

  const handleRetry = () => {
    setIsLoading(true);
    loadDocuments();
  };

  const handleDelete = async (docId, docName) => {
    if (!window.confirm(`ต้องการลบเอกสาร "${docName}" ใช่หรือไม่? การลบไม่สามารถย้อนกลับได้`)) {
      return;
    }

    setDeletingId(docId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/rag/documents/${docId}`, {
        method: "DELETE",
        headers: { ...authHeaders() },
      });
      if (res.status === 401) throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
      if (res.status === 403) throw new Error("คุณไม่มีสิทธิ์ลบเอกสาร");
      if (!res.ok) throw new Error("ลบเอกสารไม่สำเร็จ");

      setDocuments((prev) => prev.filter((d) => d.document_id !== docId));
    } catch (err) {
      console.error(err);
      alert(err.message || "ลบเอกสารไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredDocs = documents.filter((doc) =>
    doc.document_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="page-header-row">
            <h1>จัดการเอกสาร</h1>
            <input
              type="text"
              className="search-input"
              placeholder="ค้นหาเอกสาร..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loadError && (
            <div className="error-message" style={{ color: "red" }}>
              <p>{loadError}</p>
              <button type="button" onClick={handleRetry}>ลองใหม่</button>
            </div>
          )}

          {isLoading ? (
            <p>กำลังโหลดรายการเอกสาร...</p>
          ) : (
            <table className="document-table">
              <thead>
                <tr>
                  <th>ชื่อเอกสาร</th>
                  <th>ประเภท</th>
                  <th>หมวดหมู่</th>
                  <th>Chunks</th>
                  <th>วันที่อัปโหลด</th>
                  <th>จัดการ</th>
                </tr>
              </thead>

              <tbody>
                {filteredDocs.map((doc) => (
                  <tr key={doc.document_id}>
                    <td>{doc.document_name}</td>
                    <td>
                      <span className="tag tag-pdf">{doc.document_type.toUpperCase()}</span>
                    </td>
                    <td>
                      <span className="tag tag-category">{doc.category_name}</span>
                    </td>
                    <td>
                      <span className="tag tag-chunks">{doc.chunks_count} chunks</span>
                    </td>
                    <td>{formatThaiDate(doc.upload_date)}</td>
                    <td>
                      <button
                        className="view-btn"
                        onClick={() => navigate(`/admin/documents/${doc.document_id}`)}
                      >
                        ดู
                      </button>
                      <button
                        className="delete-btn"
                        disabled={deletingId === doc.document_id}
                        onClick={() => handleDelete(doc.document_id, doc.document_name)}
                      >
                        {deletingId === doc.document_id ? "กำลังลบ..." : "ลบ"}
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredDocs.length === 0 && (
                  <tr>
                    <td colSpan="6" className="empty-row">
                      {documents.length === 0 ? "ยังไม่มีเอกสารในระบบ" : "ไม่พบเอกสารที่ค้นหา"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
    </AdminLayout>
  );
}

export default DocumentManagement;