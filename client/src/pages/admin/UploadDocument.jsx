import { useState, useEffect } from "react";
import AdminSidebar from "../../components/admin/AdminSidebar";
import "./Admin.css";

function UploadDocument() {
  const [documentName, setDocumentName] = useState("");
  const [documentType, setDocumentType] = useState("PDF");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [isDone, setIsDone] = useState(false);

  const steps = [
    { upTo: 25, text: "กำลังอ่านข้อมูลจากเอกสาร..." },
    { upTo: 55, text: "กำลังแบ่งข้อมูลเป็นส่วนย่อย (Chunking)..." },
    { upTo: 85, text: "กำลังแปลงข้อมูลเป็นเวกเตอร์..." },
    { upTo: 100, text: "กำลังบันทึกลงฐานข้อมูล..." },
  ];

  useEffect(() => {
    if (!isUploading) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 4;
        const currentStep = steps.find((s) => next <= s.upTo);
        setStatusText(currentStep ? currentStep.text : "เสร็จสิ้น");

        if (next >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          setIsDone(true);
          return 100;
        }
        return next;
      });
    }, 150);

    return () => clearInterval(interval);
  }, [isUploading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setIsDone(false);
    setProgress(0);
    setStatusText(steps[0].text);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const resetForm = () => {
    setDocumentName("");
    setCategory("");
    setDescription("");
    setFile(null);
    setIsDone(false);
    setProgress(0);
  };

  return (
    <div className="admin-page">
      <AdminSidebar />

      <main className="admin-main">
        <div className="admin-content">
          <h1>อัปโหลดเอกสาร</h1>

          <form className="upload-form" onSubmit={handleSubmit}>
            <label
              className={isDragOver ? "dropzone dropzone-active" : "dropzone"}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                hidden
                disabled={isUploading}
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
                  disabled={isUploading}
                  onChange={(e) => setDocumentName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>ประเภทไฟล์</label>
                <select
                  value={documentType}
                  disabled={isUploading}
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
                  disabled={isUploading}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>หมวดหมู่</label>
                <select
                  value={category}
                  disabled={isUploading}
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

            {(isUploading || isDone) && (
              <div className="progress-box">
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="progress-info">
                  <span>{isDone ? "ประมวลผลเสร็จสิ้น ✓" : statusText}</span>
                  <span>{progress}%</span>
                </div>
              </div>
            )}

            {!isDone ? (
              <button type="submit" className="upload-btn" disabled={isUploading || !file}>
                {isUploading ? "กำลังอัปโหลด..." : "Upload Document"}
              </button>
            ) : (
              <button type="button" className="upload-btn" onClick={resetForm}>
                อัปโหลดเอกสารอื่นเพิ่ม
              </button>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}

export default UploadDocument;