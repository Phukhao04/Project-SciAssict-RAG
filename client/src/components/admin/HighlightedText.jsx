// ไฮไลต์คำที่ค้นหาเจอใน 1 บรรทัด (แค่จุดแรกที่เจอพอ ไม่ต้องทำทุกจุดที่ซ้ำ
// เพราะบรรทัดสั้นพอที่ผู้ใช้เห็นจุดแรกแล้วรู้ตำแหน่งได้เร็วอยู่แล้ว)
function HighlightedText({ text, query }) {
  const trimmed = query.trim();
  if (!trimmed) return text;
  const idx = text.toLowerCase().indexOf(trimmed.toLowerCase());
  if (idx === -1) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + trimmed.length);
  const after = text.slice(idx + trimmed.length);
  return (
    <>
      {before}
      <mark className="search-highlight">{match}</mark>
      {after}
    </>
  );
}

export default HighlightedText;
