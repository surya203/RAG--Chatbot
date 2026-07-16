"""Seed a test student user for login development."""

import sys

from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models.user import User

DEFAULT_EMAIL = "student@example.com"
DEFAULT_PASSWORD = "password123"
DEFAULT_NAME = "Test Student"


def seed_user(
    email: str = DEFAULT_EMAIL,
    password: str = DEFAULT_PASSWORD,
    full_name: str = DEFAULT_NAME,
) -> None:
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email.lower()).first()
        if existing:
            print(f"User already exists: {email}")
            return

        user = User(
            email=email.lower(),
            hashed_password=get_password_hash(password),
            full_name=full_name,
            role="student",
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        db.commit()
        print(f"Created user: {email}")
    finally:
        db.close()


if __name__ == "__main__":
    email = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_EMAIL
    password = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_PASSWORD
    name = sys.argv[3] if len(sys.argv) > 3 else DEFAULT_NAME
    seed_user(email, password, name)
