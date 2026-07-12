import { useState } from "react";
import AdminSidebar from "../../components/admin/AdminSidebar";
import "./Admin.css";

function UploadDocument() {
  const [documentName, setDocumentName] = useState("");
  const [documentType, setDocumentType] = useState("PDF");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log({ documentName, documentType, category, description, file });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="admin-page">
      <AdminSidebar />

      <main className="admin-main">
        <h1>อัปโหลดเอกสาร</h1>

        <form className="upload-form" onSubmit={handleSubmit}>
          <label
            className={isDragOver ? "dropzone dropzone-active" : "dropzone"}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              hidden
              onChange={(e) => setFile(e.target.files[0])}
            />
            <div className="dropzone-icon">📁</div>
            <p className="dropzone-text">
              {file ? file.name : "ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์"}
            </p>
            <p className="dropzone-hint">รองรับ PDF, DOCX, TXT ขนาดไม่เกิน 50 MB</p>
          </label>

          <div className="form-row">
            <div className="form-group">
              <label>ชื่อเอกสาร</label>
              <input
                type="text"
                placeholder="กรอกชื่อเอกสาร"
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>ประเภทไฟล์</label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
              >
                <option value="PDF">PDF</option>
                <option value="TXT">TXT</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>คำอธิบาย</label>
              <input
                type="text"
                placeholder="รายละเอียดเอกสาร"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>หมวดหมู่</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">เลือกหมวดหมู่</option>
                <option value="หลักสูตร">หลักสูตร</option>
                <option value="แผนการเรียน">แผนการเรียน</option>
                <option value="รายวิชา">รายวิชา</option>
                <option value="อาจารย์">อาจารย์</option>
                <option value="ประกาศ">ประกาศ</option>
              </select>
            </div>
          </div>

          <button type="submit" className="upload-btn">
            Upload Document
          </button>
        </form>
      </main>
    </div>
  );
}

export default UploadDocument;