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
import "./UploadDocument.css";

const API_BASE_URL = AppConfig.apiBase;

const STEPS = [
  { key: "meta", label: "ข้อมูลเอกสาร" },
  { key: "mark", label: "จัดโครงสร้าง" },
  { key: "preview", label: "ตรวจสอบ" },
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
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryCreateError, setCategoryCreateError] = useState("");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name || isCreatingCategory) return;

    setCategoryCreateError("");
    setIsCreatingCategory(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/rag/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_name: name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "เพิ่มหมวดหมู่ไม่สำเร็จ");

      setCategories((prev) => [...prev, data]);
      setCategoryId(String(data.category_id));
      setNewCategoryName("");
      setShowCategoryModal(false);
    } catch (err) {
      console.error(err);
      setCategoryCreateError(err.message);
    } finally {
      setIsCreatingCategory(false);
    }
  };

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

  const headingOutline = useMemo(() => {
    return lines
      .filter((line) => levels[line.index])
      .map((line) => ({
        index: line.index,
        text: line.text,
        level: levels[line.index],
      }));
  }, [lines, levels]);

  const chunkStats = useMemo(() => {
    const empty = chunks.filter((c) => !c.chunk_text.trim()).length;
    const characters = chunks.reduce((sum, c) => sum + c.chunk_text.length, 0);
    return { empty, characters };
  }, [chunks]);

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
            <>
              <div className="upload-page">
                <p className="upload-page-intro">
                  เพิ่มเอกสารเข้าสู่ฐานความรู้ของ Sci Assistant
                </p>

                <form className="upload-step-card" onSubmit={handleParse}>
                  <div className="upload-card-body">
                    <section className="upload-file-section">
                      <div className="upload-section-heading">
                        <h2>ไฟล์เอกสาร</h2>
                        <p>เลือกไฟล์ที่ต้องการเพิ่มเข้าสู่ฐานความรู้</p>
                      </div>

                      <label
                        className={isDragOver ? "upload-dropzone is-dragging" : "upload-dropzone"}
                        onDragOver={(e) => { e.preventDefault(); if (!isParsing) setIsDragOver(true); }}
                        onDragLeave={() => setIsDragOver(false)}
                        onDrop={handleDrop}
                      >
                        <input
                          type="file"
                          accept=".docx,.pdf"
                          hidden
                          disabled={isParsing}
                          onChange={(e) => {
                            setFile(e.target.files?.[0] || null);
                            setIsDragOver(false);
                          }}
                        />
                        <div className="upload-dropzone-content">
                          {!file ? (
                            <>
                              <div className="upload-icon" aria-hidden="true">↑</div>
                              <h3>วางไฟล์ที่นี่</h3>
                              <p>หรือ <span>คลิกเพื่อเลือกไฟล์</span></p>
                              <small>รองรับ DOCX และ PDF · ขนาดไม่เกิน 20 MB</small>
                            </>
                          ) : (
                            <div className="upload-selected-file">
                              <div className="upload-file-icon" aria-hidden="true">📄</div>
                              <div className="upload-file-info">
                                <strong>{file.name}</strong>
                                <span>{file.name.toLowerCase().endsWith(".pdf") ? "PDF" : "DOCX"}</span>
                              </div>
                              <button
                                type="button"
                                className="upload-remove-file"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (!isParsing) setFile(null);
                                }}
                                aria-label="เปลี่ยนไฟล์"
                                title="เปลี่ยนไฟล์"
                              >
                                ×
                              </button>
                            </div>
                          )}
                        </div>
                      </label>

                      <div className="upload-tip">
                        <span className="upload-tip-icon" aria-hidden="true">💡</span>
                        <p>
                          ระบบจะตรวจจับ Heading จากเอกสารให้อัตโนมัติหากมีอยู่แล้ว
                          และคุณสามารถตรวจสอบหรือแก้ไขโครงสร้างได้ในขั้นตอนถัดไป
                        </p>
                      </div>
                    </section>

                    <section className="upload-info-section">
                      <div className="upload-section-heading">
                        <h2>ข้อมูลเอกสาร</h2>
                        <p>ระบุรายละเอียดเพื่อช่วยจัดการเอกสาร</p>
                      </div>

                      <div className="upload-field">
                        <label>ชื่อเอกสาร <span className="upload-required">*</span></label>
                        <input
                          type="text"
                          placeholder="เช่น หลักสูตรวิทยาศาสตรบัณฑิต พ.ศ. 2569"
                          value={documentName}
                          disabled={isParsing}
                          onChange={(e) => setDocumentName(e.target.value)}
                        />
                      </div>

                      <div className="upload-field">
                        <label>หมวดหมู่ <span className="upload-required">*</span></label>
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

                        <div className="category-manage-row">
                          <span className="upload-field-hint">ใช้สำหรับจัดกลุ่มและค้นหาเอกสาร</span>
                          <button
                            type="button"
                            className="category-add-button"
                            onClick={() => {
                              setCategoryCreateError("");
                              setNewCategoryName("");
                              setShowCategoryModal(true);
                            }}
                            disabled={isParsing}
                          >
                            ＋ เพิ่มหมวดหมู่
                          </button>
                        </div>

                        {categoriesError && <p className="error-message">{categoriesError}</p>}
                      </div>

                      <div className="upload-field">
                        <label>คำอธิบาย <span className="upload-optional">ไม่บังคับ</span></label>
                        <textarea
                          rows="4"
                          placeholder="เพิ่มรายละเอียดเกี่ยวกับเอกสารนี้..."
                          value={description}
                          disabled={isParsing}
                          onChange={(e) => setDescription(e.target.value)}
                        />
                      </div>
                    </section>
                  </div>

                  {isParsing && (
                    <div className="upload-progress-card">
                      <div className="upload-progress-top">
                        <div>
                          <strong>กำลังเตรียมเอกสาร</strong>
                          <span>{uploadProgress < 85 ? "กำลังอัปโหลดไฟล์..." : "กำลังอ่านโครงสร้างเอกสาร..."}</span>
                        </div>
                        <strong>{uploadProgress}%</strong>
                      </div>
                      <div className="upload-progress-track">
                        <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    </div>
                  )}

                  {parseError && <div className="upload-error" role="alert">⚠️ {parseError}</div>}

                  <div className="upload-actions">
                    <button
                      type="button"
                      className="upload-secondary-action"
                      onClick={() => navigate("/admin/documents")}
                      disabled={isParsing}
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      className="upload-primary-action"
                      disabled={isParsing || !file || !categoryId || !documentName.trim()}
                    >
                      {isParsing && <Spinner />}
                      {isParsing ? "กำลังอ่านไฟล์..." : <>ถัดไป <span>→</span></>}
                    </button>
                  </div>
                </form>
              </div>

              {showCategoryModal && (
                <div
                  className="category-modal-backdrop"
                  onMouseDown={() => { if (!isCreatingCategory) setShowCategoryModal(false); }}
                >
                  <div
                    className="category-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="category-modal-title"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="category-modal-header">
                      <div>
                        <h2 id="category-modal-title">เพิ่มหมวดหมู่</h2>
                        <p>สร้างหมวดหมู่ใหม่สำหรับจัดกลุ่มเอกสาร</p>
                      </div>
                      <button
                        type="button"
                        className="category-modal-close"
                        onClick={() => setShowCategoryModal(false)}
                        disabled={isCreatingCategory}
                        aria-label="ปิด"
                      >
                        ×
                      </button>
                    </div>

                    <form onSubmit={handleCreateCategory}>
                      <div className="upload-field">
                        <label>ชื่อหมวดหมู่ <span className="upload-required">*</span></label>
                        <input
                          autoFocus
                          type="text"
                          value={newCategoryName}
                          placeholder="เช่น การสำเร็จการศึกษา"
                          maxLength={255}
                          disabled={isCreatingCategory}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                        />
                        <span className="upload-field-hint">
                          ใช้ชื่อที่สั้นและสื่อความหมาย เพื่อให้ค้นหาเอกสารได้ง่าย
                        </span>
                      </div>

                      {categoryCreateError && <div className="upload-error" role="alert">⚠️ {categoryCreateError}</div>}

                      <div className="category-modal-actions">
                        <button
                          type="button"
                          className="upload-secondary-action"
                          onClick={() => setShowCategoryModal(false)}
                          disabled={isCreatingCategory}
                        >
                          ยกเลิก
                        </button>
                        <button
                          type="submit"
                          className="upload-primary-action"
                          disabled={isCreatingCategory || !newCategoryName.trim()}
                        >
                          {isCreatingCategory && <Spinner />}
                          {isCreatingCategory ? "กำลังบันทึก..." : "บันทึกหมวดหมู่"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}
          {step === "mark" && (
            <div className="structure-page">
              <div className="structure-header">
                <div>
                  <p className="structure-eyebrow">ขั้นตอนที่ 2 จาก 4</p>
                  <h2>จัดโครงสร้างเอกสาร</h2>
                  <p>
                    กำหนดว่าแต่ละบรรทัดเป็น H1, H2 หรือ H3 เพื่อให้ระบบแบ่งเนื้อหาเป็น Chunk
                    ได้ถูกต้อง
                  </p>
                </div>

                <div className="structure-stats">
                  <div className="structure-stat">
                    <strong>{markedCount}</strong>
                    <span>หัวข้อ</span>
                  </div>
                  <div className="structure-stat">
                    <strong>{lines.length}</strong>
                    <span>บรรทัด</span>
                  </div>
                  {autoDetectedCount > 0 && (
                    <div className="structure-stat is-info">
                      <strong>{autoDetectedCount}</strong>
                      <span>ตรวจพบอัตโนมัติ</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="structure-guide">
                <span className="structure-guide-icon">💡</span>
                <div>
                  <strong>วิธีใช้งาน</strong>
                  <span>
                    เลือก H1 สำหรับหัวข้อหลัก, H2 สำหรับหัวข้อย่อย และ H3 สำหรับหัวข้อย่อยระดับถัดไป
                    ไม่ต้องทำเครื่องหมายทุกบรรทัด
                  </span>
                </div>
              </div>

              {autoDetectedCount > 0 && (
                <div className="auto-detect-banner">
                  ระบบตรวจพบ Heading จาก Word Style จำนวน {autoDetectedCount} รายการ และทำเครื่องหมายไว้ให้แล้ว
                  — ตรวจสอบและแก้ไขได้ตามต้องการ
                </div>
              )}

              <div className="structure-workspace">
                <section className="structure-editor-card">
                  <div className="structure-card-header">
                    <div>
                      <h3>เนื้อหาเอกสาร</h3>
                      <span>
                        {filterText.trim()
                          ? `แสดง ${visibleLines.length} จาก ${lines.length} บรรทัด`
                          : `${lines.length} บรรทัด`}
                      </span>
                    </div>

                    <div className="structure-keyboard-hint">
                      <kbd>1</kbd> H1
                      <kbd>2</kbd> H2
                      <kbd>3</kbd> H3
                      <kbd>0</kbd> ยกเลิก
                    </div>
                  </div>

                  <div className="structure-toolbar">
                    <div className="search-input-wrap structure-search-wrap">
                      <input
                        type="text"
                        className="search-input mark-search"
                        placeholder="ค้นหาข้อความในเอกสาร..."
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

                    {markedCount > 0 && (
                      <button type="button" className="structure-clear-btn" onClick={clearAllMarks}>
                        ล้างการทำเครื่องหมาย
                      </button>
                    )}
                  </div>

                  <div className="structure-line-list">
                    {visibleLines.length === 0 ? (
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
                    ) : (
                      visibleLines.map((line) => {
                        const level = levels[line.index] || 0;
                        const indent = lineIndents[line.index] || 0;
                        const rowClasses = [
                          "structure-line-row",
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
                            style={{ paddingLeft: 14 + Math.min(indent, 4) * 22 }}
                          >
                            <div className="structure-line-number">{line.index + 1}</div>

                            <div className="structure-line-content">
                              <span className="line-text">
                                <HighlightedText text={line.text} query={filterText} />
                              </span>
                              {line.kind === "table_row" && (
                                <span className="tag tag-category">ตาราง</span>
                              )}
                            </div>

                            <div className="structure-heading-picker">
                              {[1, 2, 3].map((lvl) => (
                                <button
                                  key={lvl}
                                  type="button"
                                  className={
                                    level === lvl
                                      ? `h-picker-btn active level-${lvl}`
                                      : "h-picker-btn"
                                  }
                                  onClick={() => setLevelDirect(line.index, level === lvl ? 0 : lvl)}
                                  tabIndex={-1}
                                  title={level === lvl ? `ยกเลิก H${lvl}` : `ตั้งเป็น H${lvl}`}
                                >
                                  H{lvl}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>

                <aside className="structure-outline-card">
                  <div className="structure-card-header">
                    <div>
                      <h3>โครงสร้างเอกสาร</h3>
                      <span>{markedCount} หัวข้อที่เลือก</span>
                    </div>
                  </div>

                  <div className="structure-outline">
                    {headingOutline.length === 0 ? (
                      <div className="structure-outline-empty">
                        <div>☰</div>
                        <strong>ยังไม่มีหัวข้อ</strong>
                        <span>เลือก H1, H2 หรือ H3 จากเนื้อหาด้านซ้าย</span>
                      </div>
                    ) : (
                      headingOutline.map((item) => (
                        <button
                          type="button"
                          key={item.index}
                          className={`structure-outline-item level-${item.level}`}
                          onClick={() => {
                            const el = document.getElementById(`line-${item.index}`);
                            el?.scrollIntoView({ behavior: "smooth", block: "center" });
                            el?.focus();
                          }}
                        >
                          <span className="outline-level">H{item.level}</span>
                          <span>{item.text}</span>
                        </button>
                      ))
                    )}
                  </div>
                </aside>
              </div>

              {buildError && <div className="structure-error" role="alert">⚠️ {buildError}</div>}

              <div className="structure-actions">
                <button type="button" className="switch-page-btn" onClick={() => setStep("meta")}>
                  ← กลับไปข้อมูลเอกสาร
                </button>
                <button
                  type="button"
                  className="upload-btn structure-primary-btn"
                  disabled={isBuilding || markedCount === 0}
                  onClick={handleBuildChunks}
                >
                  {isBuilding && <Spinner />}
                  {isBuilding ? "กำลังสร้าง Chunk..." : "สร้าง Chunk และตรวจสอบ →"}
                </button>
              </div>
            </div>
          )}
          {step === "preview" && (
            <div className="review-page">
              <div className="review-header">
                <div>
                  <p className="review-eyebrow">ขั้นตอนที่ 3 จาก 4</p>
                  <h2>ตรวจสอบ Chunk</h2>
                  <p>ตรวจสอบผลลัพธ์ก่อนบันทึกลงฐานความรู้ คุณยังแก้ไขเนื้อหาได้ในขั้นตอนนี้</p>
                </div>

                <div className="review-summary">
                  <div>
                    <strong>{chunks.length}</strong>
                    <span>Chunks</span>
                  </div>
                  <div>
                    <strong>{chunkStats.characters.toLocaleString()}</strong>
                    <span>ตัวอักษร</span>
                  </div>
                  <div className={chunkStats.empty > 0 ? "has-error" : "is-ok"}>
                    <strong>{chunkStats.empty}</strong>
                    <span>ว่าง</span>
                  </div>
                </div>
              </div>

              <div className="review-info">
                <span>✓</span>
                <p>
                  หัวข้อถูกล็อกตามโครงสร้างที่คุณกำหนดไว้ หากต้องการเปลี่ยนหัวข้อ
                  ให้ย้อนกลับไปที่ <strong>จัดโครงสร้างเอกสาร</strong>
                </p>
              </div>

              <div className="review-list">
                {chunks.map((c, i) => {
                  const heading = extractChunkHeading(c.parent_text, c.chunk_text);
                  const isEmpty = !c.chunk_text.trim();

                  return (
                    <article key={i} className={isEmpty ? "review-chunk is-invalid" : "review-chunk"}>
                      <div className="review-chunk-header">
                        <div className="review-chunk-title">
                          <span className="review-chunk-number">CHUNK {i + 1}</span>
                          {heading ? (
                            <div className="review-heading">
                              <span>หัวข้อ</span>
                              <strong>{heading}</strong>
                            </div>
                          ) : (
                            <span className="review-no-heading">ไม่มีหัวข้อ</span>
                          )}
                        </div>
                        <span className={isEmpty ? "review-status error" : "review-status"}>
                          {isEmpty ? "ต้องแก้ไข" : "พร้อมบันทึก"}
                        </span>
                      </div>

                      <div className="review-chunk-body">
                        <label htmlFor={`chunk-${i}`}>เนื้อหา Chunk</label>
                        <textarea
                          id={`chunk-${i}`}
                          className="chunk-edit-textarea"
                          value={c.chunk_text}
                          onChange={(e) => updateChunkBody(i, e.target.value)}
                          rows={Math.min(Math.max(c.chunk_text.split("\n").length + 1, 4), 14)}
                        />
                        <div className="review-chunk-footer">
                          <span>{c.chunk_text.length.toLocaleString()} ตัวอักษร</span>
                          {isEmpty && <span className="review-error-text">กรุณาเติมเนื้อหาก่อนบันทึก</span>}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {confirmError && <div className="review-error" role="alert">⚠️ {confirmError}</div>}

              <div className="review-actions">
                <button type="button" className="switch-page-btn" onClick={() => setStep("mark")}>
                  ← กลับไปแก้โครงสร้าง
                </button>
                <button
                  type="button"
                  className="upload-btn review-primary-btn"
                  disabled={isConfirming || chunks.length === 0 || chunkStats.empty > 0}
                  onClick={handleConfirm}
                >
                  {isConfirming && <Spinner />}
                  {isConfirming ? "กำลังบันทึก..." : "ยืนยันและบันทึกเอกสาร →"}
                </button>
              </div>
            </div>
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