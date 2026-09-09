"""
แยกส่วน "หัวข้อ" (heading) ออกจากเนื้อหา chunk

backend เก็บ parent_text = heading + "\n" + chunk_text เสมอ (ถ้ามี heading)
ถ้า parent_text === chunk_text เป๊ะ แปลว่า chunk นั้นไม่มี heading กำกับ
(เช่น chunk แรกสุดก่อนเจอ heading อันแรกในเอกสาร)

คู่กับ client/src/utils/chunkHeading.js ฝั่ง frontend - เขียน logic เดียวกัน
ไว้ทั้งสองฝั่งเพราะฝั่ง backend ต้องใช้ตอนแก้ไข chunk (ต้องรู้ heading เดิม
ก่อนประกอบ parent_text ใหม่จากเนื้อหาที่แก้แล้ว) โดยไม่พึ่งพา frontend
ส่ง heading กลับมาเอง (แหล่งความจริงเดียวคือ DB ไม่ใช่ client)
"""


def extract_chunk_heading(parent_text: str, chunk_text: str) -> str:
    if not parent_text or parent_text == chunk_text:
        return ""
    if len(parent_text) > len(chunk_text) and parent_text.endswith(chunk_text):
        prefix = parent_text[: len(parent_text) - len(chunk_text)]
        return prefix.rstrip("\n")
    return ""