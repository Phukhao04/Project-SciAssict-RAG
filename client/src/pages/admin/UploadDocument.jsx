import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../components/admin/AdminLayout";
import StepIndicator from "../../components/admin/StepIndicator";
import HighlightedText from "../../components/admin/HighlightedText";
import Spinner from "../../components/common/Spinner";
import { useAuth } from "../../hooks/useAuth";
import AppConfig from "../../config/appConfig";
import { extractChunkHeading } from "../../utils/chunkHeading";
import "./Admin.css";

const API_BASE_URL = AppConfig.apiBase;

const STEPS = [
  { key: "meta", label: "ข้อมูลเอกสาร" },
  { key: "mark", label: "ทำเครื่องหมายหัวข้อ" },
  { key: "preview", label: "ตรวจสอบ Chunk" },
  { key: "done", label: "เสร็จสิ้น" },
];

function UploadDocument() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState("meta");

  // ---- ขั้น meta: ข้อมูลเอกสาร + เลือกไฟล์ ----
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parseError, setParseError] = useState("");
  const [filterText, setFilterText] = useState(""); // ค้นหา/กรองบรรทัด สำหรับเอกสารยาว
  const [autoDetectedCount, setAutoDetectedCount] = useState(0); // จำนวนที่ pre-fill จาก Word style

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

  // ใช้ XMLHttpRequest แทน fetch เพื่อโชว์ progress ระหว่างส่งไฟล์ขึ้นจริง
  // (fetch ไม่มี event สำหรับความคืบหน้าขาส่งไฟล์ขึ้น) - pattern เดียวกับ
  // หน้าอัปโหลดเดิมก่อนรวม ต่างกันแค่ปลายทางเป็น /parse-raw (คืน list
  // บรรทัดให้ตรวจสอบ) แทนที่จะ embed+insert ตรงจนจบแบบไม่มีจุดตรวจสอบ
  const uploadAndParse = useCallback((formData) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (!e.lengthComputable) return;
        // ช่วง 0-85% คือส่งไฟล์ขึ้น server ที่เหลือ (parse ข้อความ) เร็ว
        // มากอยู่แล้ว ไม่ต้องมี step จำลองยืดยาวแบบตอน embed+insert
        const uploadPct = Math.round((e.loaded / e.total) * 85);
        setUploadProgress(uploadPct);
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadProgress(100);
          resolve(JSON.parse(xhr.responseText));
        } else {
          let detail = "อ่านไฟล์ไม่สำเร็จ กรุณาลองใหม่";
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

      xhr.open("POST", `${API_BASE_URL}/api/rag/documents/parse-raw`);
      xhr.send(formData);
    });
  }, []);

  const handleParse = async (e) => {
    e.preventDefault();
    if (isParsing) return; // กันกดซ้ำระหว่างประมวลผล (นอกเหนือจาก disabled button)
    if (!file || !categoryId || !documentName.trim() || !user?.user_id) return;

    setParseError("");
    setIsParsing(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const data = await uploadAndParse(formData);
      setLines(data.lines);

      // pre-fill จาก Word heading style ที่ตรวจพบในไฟล์ (ถ้ามี) - เป็นแค่
      // จุดเริ่มต้นให้แอดมินตรวจสอบ/แก้ไขต่อ ไม่ได้ตัดสิทธิ์การแก้ทิ้ง
      // ยังกด mark/ลบ/เปลี่ยนได้ปกติทุกบรรทัดเหมือนเดิม - ถ้าไฟล์มี
      // heading ครบและถูกต้องอยู่แล้ว แอดมินแทบไม่ต้องแก้อะไรเลย แค่
      // ตรวจสารบัญสดแล้วกด "สร้าง Chunk" ต่อได้ทันที ใกล้เคียงกับการ
      // "อัปโหลดแล้วจบ" แบบเดิม
      const preFilled = {};
      let detectedCount = 0;
      for (const line of data.lines) {
        if (line.suggested_level > 0) {
          preFilled[line.index] = line.suggested_level;
          detectedCount += 1;
        }
      }
      setLevels(preFilled);
      setAutoDetectedCount(detectedCount);
      setFilterText("");
      setStep("mark");
    } catch (err) {
      console.error(err);
      setParseError(err.message);
    } finally {
      setIsParsing(false);
    }
  };

  // ตั้งค่าตรงๆ ทีเดียว (ใช้ทั้งคีย์บอร์ด 1/2/3/0 และปุ่มเมาส์แบบ
  // direct-click) - คลิก/กด level เดิมซ้ำ = ยกเลิก (toggle off)
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

  // ระดับร่น (indent) ของแต่ละบรรทัด ใช้แสดง hierarchy ให้เห็นด้วยตา
  // เหมือน Outline View ของ Word / Obsidian - เดินตาม lines ทั้งหมดตามลำดับ
  // (ไม่ใช่ visibleLines เพราะ indent ต้องอิงโครงสร้างจริงทั้งเอกสาร
  // ไม่ใช่แค่ผลที่กรองไว้) heading เองร่นตาม (level-1), บรรทัดเนื้อหา
  // ร่นตาม level ของ heading ล่าสุดที่ครอบมันอยู่
  const lineIndents = useMemo(() => {
    const indents = {};
    let currentDepth = 0;
    for (const line of lines) {
      const markedLevel = levels[line.index];
      if (markedLevel) {
        currentDepth = markedLevel;
        indents[line.index] = markedLevel - 1;
      } else {
        indents[line.index] = currentDepth;
      }
    }
    return indents;
  }, [lines, levels]);

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
  const handleBuildChunks = async () => {
    if (isBuilding) return; // กันกดซ้ำระหว่างประมวลผล
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

  // แก้เนื้อหา chunk ตอน preview ก่อนบันทึกจริง - แก้ได้เฉพาะส่วนเนื้อหา
  // (chunk_text) เท่านั้น heading คงเดิมเสมอ ประกอบ parent_text ใหม่จาก
  // heading เดิม + เนื้อหาที่แก้แล้ว เพื่อไม่ให้โครงสร้างที่ mark ไว้ตอน
  // step ก่อนหน้าเพี้ยนไปจากการแก้ไขข้อความ
  const updateChunkBody = (index, newBody) => {
    setChunks((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        const heading = extractChunkHeading(c.parent_text, c.chunk_text);
        const parent_text = heading ? `${heading}\n${newBody}` : newBody;
        return { chunk_text: newBody, parent_text };
      })
    );
  };

  const handleConfirm = async () => {
    if (isConfirming) return; // กันกดซ้ำระหว่างประมวลผล
    if (chunks.some((c) => !c.chunk_text.trim())) {
      setConfirmError(
        "มี chunk ที่เนื้อหาว่างเปล่า กรุณาเติมเนื้อหาหรือกลับไปแก้ไขการทำเครื่องหมายหัวข้อ"
      );
      return;
    }
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
    setUploadProgress(0);
    setLines([]);
    setLevels({});
    setAutoDetectedCount(0);
    setChunks([]);
    setSavedDocId(null);
    setParseError("");
    setBuildError("");
    setConfirmError("");
  };

  return (
    <AdminLayout>
      <h1>อัปโหลดเอกสาร</h1>
      <StepIndicator steps={STEPS} currentStep={step} />

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
                  รองรับ .docx และ .pdf ขนาดไม่เกิน 20MB — ไม่ต้องใส่ Word heading
                  style มาก่อน (ถ้ามีอยู่แล้ว ระบบจะตรวจพบให้อัตโนมัติ)
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

              {isParsing && (
                <div className="progress-box">
                  <div className="progress-bar-track">
                    <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <div className="progress-info">
                    <span>
                      {uploadProgress < 85
                        ? "กำลังส่งไฟล์ขึ้นเซิร์ฟเวอร์..."
                        : "กำลังอ่านโครงสร้างเอกสาร..."}
                    </span>
                    <span>{uploadProgress}%</span>
                  </div>
                </div>
              )}

              {parseError && <p className="error-message">{parseError}</p>}

              <button
                type="submit"
                className="upload-btn"
                disabled={isParsing || !file || !categoryId || !documentName.trim()}
              >
                {isParsing && <Spinner />}
                {isParsing ? "กำลังอ่านไฟล์..." : "ถัดไป: ทำเครื่องหมายหัวข้อ"}
              </button>
            </form>
          )}

          {step === "mark" && (
            <>
              {autoDetectedCount > 0 && (
                <p className="auto-detect-banner">
                  ตรวจพบหัวข้อจาก Word Style ในไฟล์อัตโนมัติ {autoDetectedCount} รายการ
                  (ทำเครื่องหมายไว้ให้แล้ว) — ตรวจสอบสารบัญด้านขวาแล้วกด &quot;สร้าง
                  Chunk&quot; ต่อได้เลยถ้าถูกต้อง
                </p>
              )}

                <div className="mark-main">
                  <div className="search-input-wrap">
                    <input
                      type="text"
                      className="search-input mark-search"
                      placeholder="ค้นหาข้อความ เพื่อกรองบรรทัดในเอกสารยาวๆ..."
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
                  {filterText.trim() && visibleLines.length > 0 && (
                    <p className="filter-hint">
                      พบ {visibleLines.length} จาก {lines.length} บรรทัด
                    </p>
                  )}

                  <div className="mark-hint-row">
                    <span
                      className={
                        markedCount > 0 ? "mark-progress-badge active" : "mark-progress-badge"
                      }
                    >
                      ทำเครื่องหมายแล้ว {markedCount} หัวข้อ
                    </span>
                    <p className="mark-hint-line">
                      คลิก H1/H2/H3 ที่ต้องการต่อบรรทัด คลิกซ้ำที่กำลังเลือกอยู่เพื่อยกเลิก
                    </p>
                    {markedCount > 0 && (
                      <button type="button" className="clear-marks-btn" onClick={clearAllMarks}>
                        ล้างทั้งหมด
                      </button>
                    )}
                  </div>

                  <div className="line-list panel">
                    {visibleLines.length === 0 && (
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
                    {visibleLines.map((line) => {
                      const level = levels[line.index] || 0;
                      const indent = lineIndents[line.index] || 0;
                      const rowClasses = [
                        "line-row",
                        line.kind === "table_row" ? "is-table" : "",
                        level > 0 ? `is-heading-${level}` : "",
                      ]
                        .filter(Boolean)
                        .join(" ");
                      return (
                        <div
                          key={line.index}
                          id={`line-${line.index}`}
                          tabIndex={0}
                          onKeyDown={(e) => handleLineKeyDown(e, line.index)}
                          className={rowClasses}
                          style={{ paddingLeft: 12 + Math.min(indent, 4) * 20 }}
                        >
                          <div className="h-picker">
                            {[1, 2, 3].map((lvl) => (
                              <button
                                key={lvl}
                                type="button"
                                className={
                                  level === lvl
                                    ? `h-picker-btn active level-${lvl}`
                                    : "h-picker-btn"
                                }
                                onClick={() =>
                                  setLevelDirect(line.index, level === lvl ? 0 : lvl)
                                }
                                tabIndex={-1}
                                title={
                                  level === lvl
                                    ? `ยกเลิก Heading ${lvl} (คลิกซ้ำ)`
                                    : `ตั้งเป็นหัวข้อ Heading ${lvl}`
                                }
                              >
                                H{lvl}
                              </button>
                            ))}
                          </div>
                          {line.kind === "table_row" && (
                            <span className="tag tag-category">ตาราง</span>
                          )}
                          <span className="line-text">
                            <HighlightedText text={line.text} query={filterText} />
                          </span>
                        </div>
                      );
                    })}
                  </div>
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
                  {isBuilding && <Spinner />}
                  {isBuilding ? "กำลังสร้าง Chunk..." : "สร้าง Chunk และดูตัวอย่าง"}
                </button>
              </div>
            </>
          )}

          {step === "preview" && (
            <>
              <p className="panel-title">
                ตรวจสอบ chunk ที่ได้ ({chunks.length} chunk) ก่อนบันทึกจริงเข้าระบบ —
                แก้ไขเนื้อหาได้โดยตรงในกล่องด้านล่าง (หัวข้อแก้ไม่ได้ตรงนี้ ถ้าต้องการ
                เปลี่ยนหัวข้อให้กด &quot;แก้ไขการทำเครื่องหมาย&quot;)
              </p>

              <div className="chunk-list">
                {chunks.map((c, i) => {
                  const heading = extractChunkHeading(c.parent_text, c.chunk_text);
                  return (
                    <div key={i} className="chunk-item">
                      <div className="chunk-detail chunk-detail-static">
                        <div className="chunk-preview-header">
                          <span className="chunk-index-label">Chunk {i + 1}</span>
                          {heading && <span className="chunk-heading-label">{heading}</span>}
                        </div>
                        <textarea
                          className="chunk-edit-textarea"
                          value={c.chunk_text}
                          onChange={(e) => updateChunkBody(i, e.target.value)}
                          rows={Math.min(Math.max(c.chunk_text.split("\n").length, 2), 14)}
                        />
                      </div>
                    </div>
                  );
                })}
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
                  {isConfirming && <Spinner />}
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
                  อัปโหลดเอกสารอื่นเพิ่ม
                </button>
              </div>
            </div>
          )}
    </AdminLayout>
  );
}

export default UploadDocument;