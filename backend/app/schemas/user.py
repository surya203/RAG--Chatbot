from pydantic import BaseModel, EmailStr


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    full_name: str | None
    is_active: bool
    is_verified: bool

    model_config = {"from_attributes": True}
