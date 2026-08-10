from pydantic import BaseModel, EmailStr, Field


class ProfileResponse(BaseModel):
    """ข้อมูลโปรไฟล์ที่ส่งกลับให้ frontend แสดงผล"""
    user_id: int
    username: str
    email: str
    firstname: str | None = None
    lastname: str | None = None
    role_id: str
    role_name: str  # JOIN มาจากตาราง role เพื่อไม่ต้อง hardcode ชื่อ role ฝั่ง frontend


class ProfileUpdateRequest(BaseModel):
    """ผู้ใช้แก้ได้แค่ชื่อ-นามสกุล-อีเมล เท่านั้น
    username ห้ามแก้ เพราะเป็น key ที่ผูกกับ challenge-response login (authen_request/access_request)"""
    firstname: str | None = Field(default=None, max_length=100)
    lastname: str | None = Field(default=None, max_length=100)
    email: EmailStr


class PasswordChangeRequest(BaseModel):
    """ต้องใส่รหัสผ่านเดิมมาด้วยเสมอ กัน session ที่หลุดมือถูกเอาไปเปลี่ยนรหัสผ่านโดยไม่รู้ตัว"""
    current_password: str
    new_password: str = Field(..., min_length=8)