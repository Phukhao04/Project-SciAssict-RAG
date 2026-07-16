import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminSidebar from "../../components/admin/AdminSidebar";
import "./Admin.css";

const mockFileName = "ICT2564.pdf";

const mockFullText = `หลักสูตรวิทยาศาสตร์บัณฑิต
สาขาวิชาเทคโนโลยีสารสนเทศและการสื่อสาร
หลักสูตรปรับปรุง พ.ศ. 2564

สาขาวิชาเทคโนโลยีสารสนเทศและการสื่อสาร
คณะวิทยาศาสตร์
มหาวิทยาลัยสงขลานครินทร์
วิทยาเขตหาดใหญ่

------- หมวดที่ 1 ข้อมูลทั่วไป -------

1. รหัสและชื่อหลักสูตร
รหัส: 25521751104430
ชื่อภาษาไทย: หลักสูตรวิทยาศาสตร์บัณฑิต
สาขาวิชาเทคโนโลยีสารสนเทศและการสื่อสาร

------- 3.1.6 แผนการศึกษา -------`;

const mockChunks = [
  {
    id: "chunk_1",
    tag: "Study Plan",
    preview: "322-101 แคลคูลัส 1 3(3-0-6) 324-101 หลักฟิสิกส์ 1 3(3-0-6) 325-1...",
    detail: {
      unit: "หน่วยที่ 1 ภาคการศึกษาที่ 1",
      subjects: [
        "322-101 แคลคูลัส 1 3(3-0-6)",
        "324-101 หลักฟิสิกส์ 1 3(3-0-6)",
        "325-101 ปฏิบัติการฟิสิกส์ 1 1(0-3-0)",
        "332-101 พื้นฐานเขียน 3(3-0-6)",
      ],
    },
  },
  {
    id: "chunk_2",
    tag: "Study Plan",
    preview: "308-101 พื้นฐานคณิตศาสตร์คอมพิวเตอร์ 2(1-2-3) 308-102 หลักการเขียนโปรแกร...",
    detail: {
      unit: "หน่วยที่ 2 ภาคการศึกษาที่ 1",
      subjects: [
        "308-101 พื้นฐานคณิตศาสตร์คอมพิวเตอร์ 2(1-2-3)",
        "308-102 หลักการเขียนโปรแกรม 3(2-2-5)",
      ],
    },
  },
  {
    id: "chunk_3",
    tag: "Study Plan",
    preview: "308-221 กิจกรรมเสริมทักษะวิชาชีพ 2 2(1-2-3) 308-231 การเขียนโปรแกรมเชิงว...",
    detail: {
      unit: "หน่วยที่ 3 ภาคการศึกษาที่ 2",
      subjects: [
        "308-221 กิจกรรมเสริมทักษะวิชาชีพ 2 2(1-2-3)",
        "308-231 การเขียนโปรแกรมเชิงวัตถุ 3(2-2-5)",
      ],
    },
  },
];

function DocumentChunks() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [view, setView] = useState("chunks");
  const [expandedId, setExpandedId] = useState(null);

  const toggleExpand = (chunkId) => {
    setExpandedId((prev) => (prev === chunkId ? null : chunkId));
  };

  return (
    <div className="admin-page">
      <AdminSidebar />

      <main className="admin-main">
        <div className="admin-content">
          <div className="chunks-header">
            <button className="back-link" onClick={() => navigate("/admin/documents")}>
              &lt; Chunks
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
              Chunks
            </button>
          </div>

          {view === "full" && (
            <div className="full-doc-box">
              <span className="tag tag-filename">{mockFileName}</span>
              <pre className="full-doc-text">{mockFullText}</pre>
            </div>
          )}

          {view === "chunks" && (
            <div className="chunk-list">
              {mockChunks.map((chunk) => (
                <div key={chunk.id} className="chunk-item">
                  <div className="chunk-row" onClick={() => toggleExpand(chunk.id)}>
                    <span className="tag tag-chunkid">{chunk.id}</span>
                    <span className="tag tag-category">{chunk.tag}</span>
                    <span className="chunk-preview">{chunk.preview}</span>
                    <span className="chunk-caret">
                      {expandedId === chunk.id ? "▲" : "▼"}
                    </span>
                  </div>

                  {expandedId === chunk.id && (
                    <div className="chunk-detail">
                      <p className="chunk-unit">{chunk.detail.unit}</p>
                      <ul>
                        {chunk.detail.subjects.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default DocumentChunks;