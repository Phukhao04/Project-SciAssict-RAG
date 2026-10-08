from pydantic import BaseModel, ConfigDict, EmailStr, Field


class AuthenRequestBody(BaseModel):
    authen_request: str


class AccessRequestBody(BaseModel):
    authen_signature: str
    authen_token: str


class AuthResponse(BaseModel):
    is_error: bool = Field(alias="isError")
    data: dict | str | None = None
    error_message: str = Field(default="", alias="errorMessage")

    model_config = ConfigDict(populate_by_name=True)


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(
        ...,
        min_length=8,
        description="รับ plaintext ตรงนี้ครั้งเดียว ผ่าน HTTPS เท่านั้น",
    )
    email: EmailStr
    role_id: str = Field(..., max_length=10)
    firstname: str | None = None
    lastname: str | None = None


class RegisterResponse(BaseModel):
    user_id: int
    username: str
    email: str
