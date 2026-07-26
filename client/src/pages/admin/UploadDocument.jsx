import { useState, useEffect, useCallback } from "react";
import AdminSidebar from "../../components/admin/AdminSidebar";
import { useAuth } from "../../hooks/useAuth"; // path ปรับตาม Login.jsx (2 ระดับจาก pages/admin)
import "./Admin.css";

// TODO: ถ้ามี constant นี้อยู่แล้วใน utils/authService.js ให้ import จากที่นั่นแทน
const API_BASE_URL = "http://127.0.0.1:8000";

function UploadDocument() {
  const { user } = useAuth();

  const [documentName, setDocumentName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState("");

  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [isDone, setIsDone] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // ----------------------------
  // โหลดรายการหมวดหมู่จริงจาก backend ตอน mount
  // ----------------------------
  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/rag/categories`);
        if (!res.ok) throw new Error("โหลดหมวดหมู่ไม่สำเร็จ");
        const data = await res.json();
        if (!cancelled) setCategories(data);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setCategoriesError("ไม่สามารถโหลดรายการหมวดหมู่ได้ กรุณารีเฟรชหน้า");
        }
      }
    }

    loadCategories();
    return () => {
      cancelled = true;
    };
  }, []);

  // ----------------------------
  // Progress ระหว่างอัปโหลด: ใช้ XMLHttpRequest แทน fetch
  // เพราะ fetch ไม่มี event สำหรับความคืบหน้าของการ "ส่งไฟล์ขึ้น" (upload progress)
  // ----------------------------
  const uploadWithProgress = useCallback((formData) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (!e.lengthComputable) return;
        // ช่วง 0-70% คือส่งไฟล์ขึ้น server (ขนาดไฟล์เป็นตัวกำหนดเวลาจริง)
        const uploadPct = Math.round((e.loaded / e.total) * 70);
        setProgress(uploadPct);
        setStatusText("กำลังส่งไฟล์ขึ้นเซิร์ฟเวอร์...");
      });

      xhr.addEventListener("loadstart", () => {
        // เข้าสู่ช่วงประมวลผลฝั่ง server (extract -> chunk -> embed -> insert)
        // เราไม่รู้ progress จริงของฝั่ง server เลยขยับแบบประมาณเอาไว้ให้ผู้ใช้รู้ว่ายังทำงานอยู่
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setProgress(100);
          resolve(JSON.parse(xhr.responseText));
        } else {
          let detail = "อัปโหลดไม่สำเร็จ กรุณาลองใหม่";
          try {
            detail = JSON.parse(xhr.responseText).detail || detail;
          } catch {
            // response ไม่ใช่ JSON ก็ใช้ข้อความ default ไป
          }
          reject(new Error(detail));
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบว่า backend รันอยู่"));
      });

      xhr.open("POST", `${API_BASE_URL}/api/rag/documents/upload`);
      xhr.send(formData);
    });
  }, []);

  // หลังไฟล์ส่งขึ้นครบ (70%) แสดง step เชิงบรรยายไปเรื่อยๆ ระหว่างรอ server ประมวลผล
  // (extract text -> chunk -> embed -> insert) เพราะฝั่ง server ไม่มี progress event ส่งกลับมาเป็นช่วงๆ
  useEffect(() => {
    if (!isUploading || progress < 70 || progress >= 100) return;

    const steps = [
      { upTo: 78, text: "กำลังอ่านข้อมูลจากเอกสาร..." },
      { upTo: 88, text: "กำลังแบ่งข้อมูลเป็นส่วนย่อย (Chunking)..." },
      { upTo: 97, text: "กำลังแปลงข้อมูลเป็นเวกเตอร์และบันทึกลงฐานข้อมูล..." },
    ];

    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = Math.min(prev + 1, 97); // หยุดรอที่ 97% จนกว่า server จะตอบจริง
        const step = steps.find((s) => next <= s.upTo);
        setStatusText(step ? step.text : "กำลังบันทึกลงฐานข้อมูล...");
        return next;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [isUploading, progress]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !categoryId || !documentName.trim() || !user?.user_id) return;

    setUploadError("");
    setIsUploading(true);
    setIsDone(false);
    setProgress(0);
    setStatusText("กำลังส่งไฟล์ขึ้นเซิร์ฟเวอร์...");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("document_name", documentName.trim());
    formData.append("category_id", categoryId);
    formData.append("user_id", user.user_id);
    if (description.trim()) {
      formData.append("description", description.trim());
    }

    try {
      await uploadWithProgress(formData);
      setIsUploading(false);
      setIsDone(true);
    } catch (err) {
      console.error(err);
      setIsUploading(false);
      setUploadError(err.message);
    }
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
    setCategoryId("");
    setDescription("");
    setFile(null);
    setIsDone(false);
    setProgress(0);
    setUploadError("");
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
                accept=".pdf,.docx"
                hidden
                disabled={isUploading}
                onChange={(e) => setFile(e.target.files[0])}
              />
              <div className="dropzone-icon">📁</div>
              <p className="dropzone-text">
                {file ? file.name : "ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์"}
              </p>
              <p className="dropzone-hint">รองรับ PDF, DOCX ขนาดไม่เกิน 20 MB</p>
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
                <label>หมวดหมู่</label>
                <select
                  value={categoryId}
                  disabled={isUploading}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">เลือกหมวดหมู่</option>
                  {categories.map((c) => (
                    <option key={c.category_id} value={c.category_id}>
                      {c.category_name}
                    </option>
                  ))}
                </select>
                {categoriesError && (
                  <p className="error-text" style={{ color: "red", fontSize: "0.85em" }}>
                    {categoriesError}
                  </p>
                )}
              </div>
            </div>

            <div className="form-group">
              <label>คำอธิบาย</label>
              <input
                type="text"
                placeholder="รายละเอียดเอกสาร (ไม่บังคับ)"
                value={description}
                disabled={isUploading}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {(isUploading || isDone) && (
              <div className="progress-box">
                <div className="progress-bar-track">
                  <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                </div>
                <div className="progress-info">
                  <span>{isDone ? "ประมวลผลเสร็จสิ้น ✓" : statusText}</span>
                  <span>{progress}%</span>
                </div>
              </div>
            )}

            {uploadError && (
              <p className="error-message" style={{ color: "red" }}>
                {uploadError}
              </p>
            )}

            {!isDone ? (
              <button
                type="submit"
                className="upload-btn"
                disabled={isUploading || !file || !categoryId || !documentName.trim()}
              >
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