from pydantic import BaseModel, EmailStr, Field


class ProfileResponse(BaseModel):
    user_id: int
    username: str
    email: str
    firstname: str | None = None
    lastname: str | None = None
    role_id: str
    role_name: str


class ProfileUpdateRequest(BaseModel):
    """Allow profile edits without changing the login username."""

    firstname: str | None = Field(default=None, max_length=100)
    lastname: str | None = Field(default=None, max_length=100)
    email: EmailStr


class PasswordChangeRequest(BaseModel):
    """Require the current password before allowing a password change."""

    current_password: str
    new_password: str = Field(..., min_length=8)