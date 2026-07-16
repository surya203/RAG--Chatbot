import bcrypt
import hashlib
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.core.config import settings


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    return jwt.encode(
        {"sub": subject, "exp": expire, "type": "access"},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def create_refresh_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    return jwt.encode(
        {"sub": subject, "exp": expire, "type": "refresh"},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def verify_refresh_token(token: str) -> str | None:
    """Return the subject (user id) if the refresh token is valid, else None."""
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
    except JWTError:
        return None

    if payload.get("type") != "refresh":
        return None

    subject = payload.get("sub")
    return subject if isinstance(subject, str) else None


def _password_fingerprint(hashed_password: str) -> str:
    """Short, stable fingerprint of the current password hash.

    Embedding this in the reset token makes the token single-use: once the
    password changes, the stored hash changes, the fingerprint no longer
    matches, and any previously issued reset token is rejected.
    """
    return hashlib.sha256(hashed_password.encode("utf-8")).hexdigest()[:16]


def create_password_reset_token(subject: str, hashed_password: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.RESET_TOKEN_EXPIRE_MINUTES
    )
    return jwt.encode(
        {
            "sub": subject,
            "exp": expire,
            "type": "reset",
            "fp": _password_fingerprint(hashed_password),
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def verify_password_reset_token(token: str, hashed_password: str) -> str | None:
    """Return the subject (user id) if the reset token is valid, else None."""
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
    except JWTError:
        return None

    if payload.get("type") != "reset":
        return None
    if payload.get("fp") != _password_fingerprint(hashed_password):
        return None

    subject = payload.get("sub")
    return subject if isinstance(subject, str) else None
