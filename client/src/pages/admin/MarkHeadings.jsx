import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "../../components/admin/AdminSidebar";
import { useAuth } from "../../hooks/useAuth";
import "./Admin.css";

// TODO: ถ้ามี constant นี้อยู่แล้วใน utils/authService.js ให้ import จากที่นั่นแทน
const API_BASE_URL = "http://127.0.0.1:8000";

const LEVEL_LABELS = { 1: "H1", 2: "H2", 3: "H3" };
const LEVEL_CYCLE = [0, 1, 2, 3]; // 0 = ไม่ใช่หัวข้อ

// flow: meta (กรอกข้อมูล+เลือกไฟล์) -> mark (ทำเครื่องหมายหัวข้อ)
// -> preview (ดู chunk ที่ได้) -> done (บันทึกแล้ว)

function MarkHeadings() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState("meta");

  // ---- ขั้น meta: เหมือน UploadDocument.jsx ----
  const [documentName, setDocumentName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState("");

  // ---- ขั้น mark: ผลจาก /parse-raw + heading level ที่แอดมินเลือก ----
  const [lines, setLines] = useState([]);
  const [levels, setLevels] = useState({}); // { [lineIndex]: level }
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [filterText, setFilterText] = useState(""); // ค้นหา/กรองบรรทัด สำหรับเอกสารยาว

  // ---- ขั้น preview: ผลจาก /build-chunks ----
  const [chunks, setChunks] = useState([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildError, setBuildError] = useState("");

  // ---- ขั้น done: ผลจาก /confirm-manual ----
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [savedDocId, setSavedDocId] = useState(null);

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

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleParse = async (e) => {
    e.preventDefault();
    if (!file || !categoryId || !documentName.trim() || !user?.user_id) return;

    setParseError("");
    setIsParsing(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/rag/documents/parse-raw`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "อ่านไฟล์ไม่สำเร็จ");
      }
      const data = await res.json();
      setLines(data.lines);
      setLevels({});
      setFilterText("");
      setStep("mark");
    } catch (err) {
      console.error(err);
      setParseError(err.message);
    } finally {
      setIsParsing(false);
    }
  };

  // คลิกป้ายซ้ายของแต่ละบรรทัดเพื่อวนระดับ (สำหรับคนใช้เมาส์): ไม่ใช่หัวข้อ
  // -> H1 -> H2 -> H3 -> วนกลับ - ยังเก็บไว้เป็นทางเลือกคู่กับคีย์บอร์ด
  const cycleLevel = (index) => {
    setLevels((prev) => {
      const current = prev[index] || 0;
      const idx = LEVEL_CYCLE.indexOf(current);
      const next = LEVEL_CYCLE[(idx + 1) % LEVEL_CYCLE.length];
      const updated = { ...prev };
      if (next === 0) {
        delete updated[index];
      } else {
        updated[index] = next;
      }
      return updated;
    });
  };

  // ตั้งค่าตรงๆ ทีเดียว (ใช้กับคีย์บอร์ด 1/2/3/0) แทนการวนคลิกหลายที
  const setLevelDirect = (index, level) => {
    setLevels((prev) => {
      const updated = { ...prev };
      if (level === 0) {
        delete updated[index];
      } else {
        updated[index] = level;
      }
      return updated;
    });
  };

  const clearAllMarks = () => setLevels({});

  // เอกสารยาวๆ ไม่ต้องไล่สายตาทีละบรรทัด พิมพ์คำที่รู้ว่าน่าจะเป็นหัวข้อ
  // กรองให้เห็นเฉพาะบรรทัดที่ match (line.index เดิมยังอ้างอิงตำแหน่งจริง
  // ในเอกสารเสมอ ต่อให้ list ที่เห็นถูกกรองอยู่ก็ไม่กระทบการ build chunk)
  const visibleLines = useMemo(() => {
    if (!filterText.trim()) return lines;
    const needle = filterText.trim().toLowerCase();
    return lines.filter((l) => l.text.toLowerCase().includes(needle));
  }, [lines, filterText]);

  // เลื่อนโฟกัสด้วยลูกศรขึ้น/ลง โดยอิงตำแหน่งใน visibleLines (ไม่ใช่ lines
  // ทั้งหมด) เพื่อให้เลื่อนเฉพาะในผลที่กรองไว้เมื่อมีการค้นหาอยู่
  const moveFocus = (currentLineIndex, direction) => {
    const pos = visibleLines.findIndex((l) => l.index === currentLineIndex);
    if (pos === -1) return;
    const nextPos = pos + direction;
    if (nextPos < 0 || nextPos >= visibleLines.length) return;
    const el = document.getElementById(`line-${visibleLines[nextPos].index}`);
    if (el) el.focus();
  };

  const handleLineKeyDown = (e, lineIndex) => {
    if (e.key === "1" || e.key === "2" || e.key === "3") {
      e.preventDefault();
      setLevelDirect(lineIndex, Number(e.key));
      moveFocus(lineIndex, 1); // ตั้งค่าเสร็จเลื่อนไปบรรทัดถัดไปให้เลย ไม่ต้องขยับเมาส์
    } else if (e.key === "0" || e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      setLevelDirect(lineIndex, 0);
      moveFocus(lineIndex, 1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      moveFocus(lineIndex, 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveFocus(lineIndex, -1);
    }
  };

  const markedCount = Object.keys(levels).length;

  // สารบัญสด: อัปเดตตามที่ mark ไปแล้วแบบ real-time ไม่ต้องกด "สร้าง Chunk"
  // ก่อนถึงจะเห็นว่าโครงสร้างที่ทำไปถูกไหม
  const liveOutline = useMemo(() => {
    return lines
      .filter((l) => levels[l.index])
      .map((l) => ({ index: l.index, level: levels[l.index], text: l.text }));
  }, [lines, levels]);

  const handleBuildChunks = async () => {
    if (markedCount === 0) {
      setBuildError("กรุณาเลือกอย่างน้อย 1 บรรทัดเป็นหัวข้อ ก่อนสร้าง chunk");
      return;
    }
    setBuildError("");
    setIsBuilding(true);

    const marks = Object.entries(levels).map(([lineIndex, level]) => ({
      line_index: Number(lineIndex),
      level,
    }));

    try {
      const res = await fetch(`${API_BASE_URL}/api/rag/documents/build-chunks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines, marks }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "สร้าง chunk ไม่สำเร็จ");
      }
      const data = await res.json();
      setChunks(data.chunks);
      setStep("preview");
    } catch (err) {
      console.error(err);
      setBuildError(err.message);
    } finally {
      setIsBuilding(false);
    }
  };

  const handleConfirm = async () => {
    setConfirmError("");
    setIsConfirming(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/rag/documents/confirm-manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chunks,
          document_name: documentName.trim(),
          document_type: file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "docx",
          category_id: Number(categoryId),
          user_id: user.user_id,
          description: description.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "บันทึกเอกสารไม่สำเร็จ");
      }
      const data = await res.json();
      setSavedDocId(data.document_id);
      setStep("done");
    } catch (err) {
      console.error(err);
      setConfirmError(err.message);
    } finally {
      setIsConfirming(false);
    }
  };

  const resetAll = () => {
    setStep("meta");
    setDocumentName("");
    setCategoryId("");
    setDescription("");
    setFile(null);
    setLines([]);
    setLevels({});
    setChunks([]);
    setSavedDocId(null);
    setParseError("");
    setBuildError("");
    setConfirmError("");
  };

  return (
    <div className="admin-page">
      <AdminSidebar />

      <main className="admin-main">
        <div className="admin-content">
          <h1>ทำเครื่องหมายหัวข้อเอง</h1>

          {step === "meta" && (
            <form className="upload-form" onSubmit={handleParse}>
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
                  accept=".docx,.pdf"
                  hidden
                  disabled={isParsing}
                  onChange={(e) => setFile(e.target.files[0])}
                />
                <div className="dropzone-icon">📄</div>
                <p className="dropzone-text">
                  {file ? file.name : "ลากไฟล์ .docx หรือ .pdf มาวาง หรือคลิกเพื่อเลือกไฟล์"}
                </p>
                <p className="dropzone-hint">
                  รองรับ .docx และ .pdf — ไม่ต้องใส่ Word heading style มาก่อน
                </p>
              </label>

              <div className="form-row">
                <div className="form-group">
                  <label>ชื่อเอกสาร</label>
                  <input
                    type="text"
                    placeholder="กรอกชื่อเอกสาร"
                    value={documentName}
                    disabled={isParsing}
                    onChange={(e) => setDocumentName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>หมวดหมู่</label>
                  <select
                    value={categoryId}
                    disabled={isParsing}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="">เลือกหมวดหมู่</option>
                    {categories.map((c) => (
                      <option key={c.category_id} value={c.category_id}>
                        {c.category_name}
                      </option>
                    ))}
                  </select>
                  {categoriesError && <p className="error-message">{categoriesError}</p>}
                </div>
              </div>

              <div className="form-group">
                <label>คำอธิบาย</label>
                <input
                  type="text"
                  placeholder="รายละเอียดเอกสาร (ไม่บังคับ)"
                  value={description}
                  disabled={isParsing}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {parseError && <p className="error-message">{parseError}</p>}

              <button
                type="submit"
                className="upload-btn"
                disabled={isParsing || !file || !categoryId || !documentName.trim()}
              >
                {isParsing ? "กำลังอ่านไฟล์..." : "อ่านไฟล์และเริ่มทำเครื่องหมาย"}
              </button>
            </form>
          )}

          {step === "mark" && (
            <>
              <p className="panel-title">
                ทำเครื่องหมายแล้ว {markedCount} บรรทัด — คลิกบรรทัดแล้วกด{" "}
                <strong>1 / 2 / 3</strong> เพื่อตั้งเป็น H1/H2/H3 ทันที, กด{" "}
                <strong>0</strong> เพื่อยกเลิก, ใช้ลูกศร <strong>↑ / ↓</strong> เลื่อนไปบรรทัดถัดไป
                โดยไม่ต้องใช้เมาส์ (หรือจะคลิกป้ายซ้ายวนระดับเองก็ได้)
              </p>

              <div className="mark-layout">
                <div className="mark-main">
                  <input
                    type="text"
                    className="search-input mark-search"
                    placeholder="ค้นหาข้อความ เพื่อกรองบรรทัดในเอกสารยาวๆ..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                  />
                  {filterText.trim() && (
                    <p className="filter-hint">
                      พบ {visibleLines.length} จาก {lines.length} บรรทัด
                    </p>
                  )}

                  <div className="line-list panel">
                    {visibleLines.length === 0 && (
                      <p className="empty-row">ไม่พบบรรทัดที่ตรงกับคำค้นหา</p>
                    )}
                    {visibleLines.map((line) => {
                      const level = levels[line.index] || 0;
                      return (
                        <div
                          key={line.index}
                          id={`line-${line.index}`}
                          tabIndex={0}
                          onKeyDown={(e) => handleLineKeyDown(e, line.index)}
                          className={
                            line.kind === "table_row" ? "line-row is-table" : "line-row"
                          }
                        >
                          <button
                            type="button"
                            className={`level-btn level-${level}`}
                            onClick={() => cycleLevel(line.index)}
                            tabIndex={-1}
                            title="คลิกเพื่อวนระดับหัวข้อ (หรือโฟกัสบรรทัดแล้วกด 1/2/3)"
                          >
                            {LEVEL_LABELS[level] || "＋"}
                          </button>
                          {line.kind === "table_row" && (
                            <span className="tag tag-category">ตาราง</span>
                          )}
                          <span className="line-text">{line.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <aside className="mark-sidebar panel">
                  <div className="mark-sidebar-header">
                    <p className="panel-title" style={{ margin: 0 }}>
                      สารบัญ (สด)
                    </p>
                    {markedCount > 0 && (
                      <button type="button" className="clear-marks-btn" onClick={clearAllMarks}>
                        ล้างทั้งหมด
                      </button>
                    )}
                  </div>

                  {liveOutline.length === 0 ? (
                    <p className="outline-empty">ยังไม่มีบรรทัดที่ทำเครื่องหมายเป็นหัวข้อ</p>
                  ) : (
                    <ul className="outline-list">
                      {liveOutline.map((item) => (
                        <li
                          key={item.index}
                          className="outline-item"
                          style={{ paddingLeft: (item.level - 1) * 16 }}
                          onClick={() => {
                            const el = document.getElementById(`line-${item.index}`);
                            if (el) {
                              el.scrollIntoView({ behavior: "smooth", block: "center" });
                              el.focus();
                            }
                          }}
                        >
                          <span className={`heading-chip heading-chip-${item.level}`}>
                            H{item.level}
                          </span>{" "}
                          {item.text}
                        </li>
                      ))}
                    </ul>
                  )}
                </aside>
              </div>

              {buildError && <p className="error-message">{buildError}</p>}

              <div className="mark-actions">
                <button type="button" className="switch-page-btn" onClick={() => setStep("meta")}>
                  &lt; ย้อนกลับ
                </button>
                <button
                  type="button"
                  className="upload-btn"
                  disabled={isBuilding}
                  onClick={handleBuildChunks}
                >
                  {isBuilding ? "กำลังสร้าง Chunk..." : "สร้าง Chunk และดูตัวอย่าง"}
                </button>
              </div>
            </>
          )}

          {step === "preview" && (
            <>
              <p className="panel-title">
                ตรวจสอบ chunk ที่ได้ ({chunks.length} chunk) ก่อนบันทึกจริงเข้าระบบ
              </p>

              <div className="chunk-list">
                {chunks.map((c, i) => (
                  <div key={i} className="chunk-item">
                    <div className="chunk-detail chunk-detail-static">
                      <pre className="full-doc-text">{c.parent_text}</pre>
                    </div>
                  </div>
                ))}
              </div>

              {confirmError && <p className="error-message">{confirmError}</p>}

              <div className="mark-actions">
                <button type="button" className="switch-page-btn" onClick={() => setStep("mark")}>
                  &lt; แก้ไขการทำเครื่องหมาย
                </button>
                <button
                  type="button"
                  className="upload-btn"
                  disabled={isConfirming}
                  onClick={handleConfirm}
                >
                  {isConfirming ? "กำลังบันทึก..." : "ยืนยัน บันทึกเข้าระบบ"}
                </button>
              </div>
            </>
          )}

          {step === "done" && (
            <div className="panel">
              <p>บันทึกเอกสารเรียบร้อยแล้ว ({chunks.length} chunk)</p>
              <div className="mark-actions">
                <button
                  type="button"
                  className="upload-btn"
                  onClick={() => navigate(`/admin/documents/${savedDocId}`)}
                >
                  ดูเอกสารที่บันทึก
                </button>
                <button type="button" className="switch-page-btn" onClick={resetAll}>
                  ทำเอกสารอื่นเพิ่ม
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default MarkHeadings;