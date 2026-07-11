"""
Section-based chunking สำหรับเอกสารที่มีโครงสร้างชัดเจน
(แผนการศึกษา, หลักสูตร, ระเบียบ ฯลฯ) ต่างจาก chunking.py เดิม
ที่ตัดตามประโยค เหมาะกับข้อความบรรยาย/prose เท่านั้น

ใช้เมื่อเอกสารมีหัวข้อซ้อนกันเป็นลำดับชั้น เช่น:
    ปีที่ 1
      ภาคการศึกษาที่ 1
        322-101 แคลคูลัส 1   3(3-0-6)
        ...
      ภาคการศึกษาที่ 2
        ...
    ปีที่ 2
      ...
"""
import re
from dataclasses import dataclass, field


@dataclass
class SectionChunk:
    text: str
    chunk_index: int
    metadata: dict = field(default_factory=dict)


# regex จับหัวข้อ "ปีที่ X" และ "ภาคการศึกษาที่ X" (รองรับเลขไทย/อารบิก, มี/ไม่มีช่องว่าง)
YEAR_PATTERN = re.compile(r"(?:ชั้น)?ปีที่\s*(\d+)")
SEMESTER_PATTERN = re.compile(r"ภาคการศึกษาที่\s*(\d+)")


def chunk_curriculum(text: str, header_prefix: str = "") -> list[SectionChunk]:
    """
    แบ่งเอกสารแผนการศึกษาเป็น chunk ตามภาคการศึกษา
    แต่ละ chunk = รายวิชาทั้งหมดในเทอมนั้น พร้อม context "ปีที่ X ภาคการศึกษาที่ Y" กำกับไว้ในเนื้อหา

    header_prefix: ข้อความส่วนหัว (ชื่อหลักสูตร, ปีที่ปรับปรุง) ที่จะแปะไว้ทุก chunk
                   เพื่อให้ผลค้นหารู้ที่มาแม้ chunk เดียวโดดๆ
    """
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]

    chunks: list[SectionChunk] = []
    current_year = None
    current_semester = None
    current_lines: list[str] = []
    idx = 0

    def flush():
        nonlocal idx, current_lines
        if not current_lines:
            return
        context_header = header_prefix
        if current_year:
            context_header += f" ปีที่ {current_year}"
        if current_semester:
            context_header += f" ภาคการศึกษาที่ {current_semester}"

        body = "\n".join(current_lines)
        full_text = f"{context_header.strip()}\n{body}" if context_header.strip() else body

        chunks.append(
            SectionChunk(
                text=full_text,
                chunk_index=idx,
                metadata={"year": current_year, "semester": current_semester},
            )
        )
        idx += 1
        current_lines = []

    for line in lines:
        # ใช้ .match() (ไม่ใช่ .search()) เพื่อเช็คเฉพาะจุดเริ่มบรรทัด
        # กัน false positive จากประโยคที่มีคำว่า "ภาคการศึกษาที่/ปีที่" ปนอยู่กลางข้อความ
        # เช่น "...ต่อเนื่องในภาคการศึกษาที่ 2" ไม่ใช่หัวข้อจริง
        year_match = YEAR_PATTERN.match(line)
        semester_match = SEMESTER_PATTERN.match(line)

        if year_match:
            # เจอหัวข้อปีใหม่ -> ปิด chunk เก่า (ถ้ามี) แล้วเริ่มปีใหม่
            flush()
            current_year = year_match.group(1)
            current_semester = None
            continue

        if semester_match:
            # เจอหัวข้อเทอมใหม่ -> ปิด chunk เทอมก่อนหน้า แล้วเริ่มเทอมใหม่
            flush()
            current_semester = semester_match.group(1)
            continue

        # บรรทัดข้อมูลรายวิชา/หมายเหตุ ให้สะสมไว้ในเทอมปัจจุบัน
        current_lines.append(line)

    flush()  # ปิด chunk สุดท้ายที่ค้างอยู่

    return chunks


if __name__ == "__main__":
    sample = """หลักสูตรวิทยาศาสตรบัณฑิต สาขาวิชาเทคโนโลยีสารสนเทศและการสื่อสาร
หลักสูตรปรับปรุง พ.ศ. 2564
แผนการศึกษาตลอดหลักสูตร
ปีที่ 1
ภาคการศึกษาที่ 1
322-101 แคลคูลัส 1 3(3-0-6)
324-101 เคมีทั่วไป 1 3(3-0-6)
330-101 หลักชีววิทยา 1 3(3-0-6)
รวม 19(16-8-32)
ภาคการศึกษาที่ 2
308-101 พื้นฐานเทคโนโลยีสารสนเทศและการสื่อสาร 2((1)-2-3)
308-102 คณิตศาสตร์สำหรับเทคโนโลยีสารสนเทศ 3((2)-2-5)
ปีที่ 2
ภาคการศึกษาที่ 1
308-201 โครงสร้างข้อมูล 3((2)-2-5)"""

    result = chunk_curriculum(sample, header_prefix="หลักสูตร ICT ปรับปรุง 2564")
    for c in result:
        print(f"--- chunk {c.chunk_index} (metadata={c.metadata}) ---")
        print(c.text)
        print()


# regex จับรหัสวิชาที่ขึ้นต้นบรรทัด เช่น "315-100G2A", "322-101"
COURSE_CODE_PATTERN = re.compile(r"^(\d{3}-\d{3}[A-Za-z0-9]*)\s")
# regex จับหัวข้อหมวดวิชาย่อย เช่น "ก. หมวดรายวิชาศึกษาทั่วไป", "กลุ่ม GE1 ภาษาและการสื่อสาร"
CATEGORY_HEADER_PATTERN = re.compile(r"^(ก\.|ข\.|ค\.|ง\.|กลุ่ม\s)")


def chunk_course_descriptions(text: str, header_prefix: str = "") -> list[SectionChunk]:
    """
    แบ่ง 'คำอธิบายรายวิชา' เป็น chunk ทีละวิชา (1 รหัสวิชา = 1 chunk)
    แนบ context หมวดหมู่ล่าสุด (เช่น 'ก. หมวดรายวิชาศึกษาทั่วไป > กลุ่ม GE1') ไว้ในทุก chunk
    เพื่อให้ค้นหาแล้วรู้ว่าวิชานี้อยู่หมวดไหนแม้ไม่มีบริบทรอบข้าง
    """
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]

    chunks: list[SectionChunk] = []
    current_category = ""
    current_code = None
    current_lines: list[str] = []
    idx = 0

    def flush():
        nonlocal idx, current_lines, current_code
        if not current_lines or current_code is None:
            current_lines = []
            return
        context_header = header_prefix
        if current_category:
            context_header += f" | {current_category}"

        body = "\n".join(current_lines)
        full_text = f"{context_header.strip()}\n{body}" if context_header.strip() else body

        chunks.append(
            SectionChunk(
                text=full_text,
                chunk_index=idx,
                metadata={"course_code": current_code, "category": current_category},
            )
        )
        idx += 1
        current_lines = []

    for line in lines:
        code_match = COURSE_CODE_PATTERN.match(line)
        if code_match:
            flush()
            current_code = code_match.group(1)
            current_lines.append(line)
            continue

        if CATEGORY_HEADER_PATTERN.match(line):
            # หัวข้อหมวดใหม่ -> ปิด chunk วิชาก่อนหน้า แล้วอัปเดต category (แต่ยังไม่เริ่ม chunk ใหม่จนกว่าจะเจอรหัสวิชา)
            flush()
            current_code = None
            current_category = line
            continue

        # บรรทัดคำอธิบาย (ไทย/อังกฤษ) ให้สะสมไว้ในวิชาปัจจุบัน ถ้ายังไม่เจอรหัสวิชาแรกให้ข้ามไป
        if current_code is not None:
            current_lines.append(line)

    flush()
    return chunks