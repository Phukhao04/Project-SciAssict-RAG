// แสดง heading path แบบ breadcrumb เช่น "บทที่ 1 › หัวข้อย่อย › ..."
// path เป็น string คั่นด้วย " > " (รูปแบบที่ backend ประกอบมาให้)
function HeadingBreadcrumb({ path }) {
  if (!path) {
    return <span className="tag tag-no-heading">ไม่มีหัวข้อกำกับ</span>;
  }
  const parts = path.split(" > ");
  return (
    <div className="heading-breadcrumb">
      {parts.map((part, i) => (
        <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {i > 0 && <span className="heading-sep">›</span>}
          <span className={`heading-chip heading-chip-${Math.min(i + 1, 3)}`}>{part}</span>
        </span>
      ))}
    </div>
  );
}

export default HeadingBreadcrumb;
