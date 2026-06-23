from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    message: str
    # Dev-only: the reset token is returned directly here because email
    # delivery is not wired up yet. In production this field stays None and
    # the token is emailed to the user instead.
    reset_token: str | None = None


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class MessageResponse(BaseModel):
    message: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginResponse(BaseModel):
    user: "UserPublic"
    tokens: TokenResponse


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    full_name: str | None
    is_verified: bool

    model_config = {"from_attributes": True}


LoginResponse.model_rebuild()
