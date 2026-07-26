from pydantic import BaseModel


class UserListItem(BaseModel):
    user_id: int
    username: str
    email: str
    role_id: str
    role_name: str
    firstname: str | None = None
    lastname: str | None = None


class UserRoleUpdateRequest(BaseModel):
    role_id: str


class RoleItem(BaseModel):
    role_id: str
    role_name: str