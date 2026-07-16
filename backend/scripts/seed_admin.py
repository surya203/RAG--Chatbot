"""Seed an admin user for the LMS admin dashboard."""

import sys

from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models.user import ROLE_ADMIN, User

DEFAULT_EMAIL = "admin@example.com"
DEFAULT_PASSWORD = "admin12345"
DEFAULT_NAME = "Admin"


def seed_admin(
    email: str = DEFAULT_EMAIL,
    password: str = DEFAULT_PASSWORD,
    full_name: str = DEFAULT_NAME,
) -> None:
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email.lower()).first()
        if existing:
            if existing.role != ROLE_ADMIN:
                existing.role = ROLE_ADMIN
                db.commit()
                print(f"Updated existing user to admin: {email}")
            else:
                print(f"Admin already exists: {email}")
            return

        user = User(
            email=email.lower(),
            hashed_password=get_password_hash(password),
            full_name=full_name,
            role=ROLE_ADMIN,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        db.commit()
        print(f"Created admin: {email} / {password}")
    finally:
        db.close()


if __name__ == "__main__":
    email = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_EMAIL
    password = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_PASSWORD
    name = sys.argv[3] if len(sys.argv) > 3 else DEFAULT_NAME
    seed_admin(email, password, name)
