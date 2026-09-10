// แถบบอกขั้นตอน (meta -> mark -> preview -> done) ของหน้าอัปโหลดเอกสาร
// รับ steps เข้ามาเพื่อให้ยืดหยุ่นถ้าอนาคตมี flow อื่นที่หน้าตาเหมือนกัน
function StepIndicator({ steps, currentStep }) {
  const currentIdx = steps.findIndex((s) => s.key === currentStep);
  return (
    <div className="step-indicator">
      {steps.map((s, i) => {
        const state = i < currentIdx ? "done" : i === currentIdx ? "current" : "";
        return (
          <div key={s.key} className={`step-indicator-item ${state}`}>
            <span className="step-indicator-dot">{i < currentIdx ? "✓" : i + 1}</span>
            <span className="step-indicator-label">{s.label}</span>
            {i < steps.length - 1 && <span className="step-indicator-line" />}
          </div>
        );
      })}
    </div>
  );
}

export default StepIndicator;
