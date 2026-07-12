from pydantic import BaseModel, Field, ConfigDict


class AuthenRequestBody(BaseModel):
    authen_request: str = Field(alias="authen_request")

    model_config = ConfigDict(populate_by_name=True)


class AccessRequestBody(BaseModel):
    authen_signature: str
    authen_token: str


class AuthResponse(BaseModel):
    is_error: bool = Field(alias="isError")
    data: dict | str | None = None
    error_message: str = Field(default="", alias="errorMessage")

    model_config = ConfigDict(populate_by_name=True)