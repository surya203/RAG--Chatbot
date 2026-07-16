from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    get_password_hash,
    verify_password,
    verify_password_reset_token,
    verify_refresh_token,
)
from app.db.session import get_db
from app.models.user import ROLE_STUDENT, User
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    LoginResponse,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserPublic,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _build_login_response(user: User) -> LoginResponse:
    return LoginResponse(
        user=UserPublic(
            id=str(user.id),
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            is_verified=user.is_verified,
        ),
        tokens=TokenResponse(
            access_token=create_access_token(str(user.id)),
            refresh_token=create_refresh_token(str(user.id)),
        ),
    )


@router.post("/register", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    email = payload.email.lower()

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    user = User(
        email=email,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
        role=ROLE_STUDENT,
        is_active=True,
        # Email verification is skipped for now, so new accounts are
        # considered verified on signup.
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Log the user in immediately after registering.
    return _build_login_response(user)


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    return _build_login_response(user)


@router.post("/refresh", response_model=TokenResponse)
def refresh_tokens(payload: RefreshRequest, db: Session = Depends(get_db)):
    """Exchange a valid refresh token for a new access + refresh pair."""
    user_id = verify_refresh_token(payload.refresh_token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()

    # Always return the same message so the endpoint can't be used to
    # enumerate which emails have accounts.
    generic_message = (
        "If an account exists for that email, a password reset link has been issued."
    )

    if not user or not user.is_active:
        return ForgotPasswordResponse(message=generic_message)

    reset_token = create_password_reset_token(str(user.id), user.hashed_password)

    # Dev-only: return the token directly because email delivery is not wired
    # up yet. In production, email this to the user and leave reset_token None.
    return ForgotPasswordResponse(message=generic_message, reset_token=reset_token)


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    invalid_token_error = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid or expired reset token",
    )

    # The token is bound to the current password hash, so we must locate the
    # user before we can validate it. Decode without expiry check first to get
    # the subject, then fully verify against that user's hash.
    try:
        unverified = jwt.decode(
            payload.token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"verify_exp": False},
        )
    except JWTError as exc:
        raise invalid_token_error from exc

    user_id = unverified.get("sub")
    if not user_id:
        raise invalid_token_error

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise invalid_token_error

    # Full validation: signature, expiry, type, and password fingerprint.
    if verify_password_reset_token(payload.token, user.hashed_password) != str(user.id):
        raise invalid_token_error

    user.hashed_password = get_password_hash(payload.new_password)
    db.add(user)
    db.commit()

    return MessageResponse(message="Password has been reset successfully")
