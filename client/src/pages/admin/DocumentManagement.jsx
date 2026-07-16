import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "../../components/admin/AdminSidebar";
import "./Admin.css";

function DocumentManagement() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const documents = [
    { id: 1, name: "แผนการเรียน.pdf", category: "หลักสูตร", type: "PDF", chunks: 6, date: "11/07/2026" },
    { id: 2, name: "รายชื่ออาจารย์.pdf", category: "อาจารย์", type: "PDF", chunks: 4, date: "10/07/2026" },
    { id: 3, name: "ประกาศทุน.pdf", category: "ประกาศ", type: "PDF", chunks: 3, date: "09/07/2026" },
  ];

  const filteredDocs = documents.filter((doc) =>
    doc.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="admin-page">
      <AdminSidebar />

      <main className="admin-main">
        <div className="admin-content">
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
                <tr key={doc.id}>
                  <td>{doc.name}</td>
                  <td>
                    <span className="tag tag-pdf">{doc.type}</span>
                  </td>
                  <td>
                    <span className="tag tag-category">{doc.category}</span>
                  </td>
                  <td>
                    <span className="tag tag-chunks">{doc.chunks} chunks</span>
                  </td>
                  <td>{doc.date}</td>
                  <td>
                    <button
                      className="view-btn"
                      onClick={() => navigate(`/admin/documents/${doc.id}`)}
                    >
                      ดู
                    </button>
                    <button className="delete-btn">ลบ</button>
                  </td>
                </tr>
              ))}

              {filteredDocs.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-row">
                    ไม่พบเอกสารที่ค้นหา
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default DocumentManagement;