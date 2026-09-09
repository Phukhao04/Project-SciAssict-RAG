// แยกส่วน "หัวข้อ" (heading) ออกจากเนื้อหา chunk
//
// backend เก็บ parent_text = heading + "\n" + chunk_text เสมอ (ถ้ามี heading)
// ถ้า parent_text === chunk_text เป๊ะ แปลว่า chunk นั้นไม่มี heading กำกับ
// (เช่น chunk แรกสุดก่อนเจอ heading อันแรกในเอกสาร)
//
// เดิม logic นี้ถูกเขียนซ้ำเป็น extractChunkHeading (UploadDocument.jsx)
// กับ extractHeadingPath (DocumentChunks.jsx) — รวมมาไว้ที่เดียว
// คืน "" เมื่อไม่มี heading เพื่อให้ผู้เรียกเช็ก truthiness ได้ตรงไปตรงมา
export function extractChunkHeading(parentText, chunkText) {
  if (!parentText || parentText === chunkText) return "";
  if (parentText.length > chunkText.length && parentText.endsWith(chunkText)) {
    return parentText
      .slice(0, parentText.length - chunkText.length)
      .replace(/\n$/, "");
  }
  return "";
}
