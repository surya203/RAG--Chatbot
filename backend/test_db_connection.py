"""Temporary script to test the database connection.

Run from the backend directory:
    .venv/Scripts/python.exe test_db_connection.py
"""

import sys

from sqlalchemy import text

from app.core.config import settings
from app.db.session import engine


def main() -> int:
    # Hide the password when printing the URL.
    url = str(engine.url)
    safe_url = url
    if engine.url.password:
        safe_url = url.replace(engine.url.password, "****")
    print(f"Connecting to: {safe_url}")

    try:
        with engine.connect() as conn:
            version = conn.execute(text("SELECT version()")).scalar_one()
            db_name = conn.execute(text("SELECT current_database()")).scalar_one()
            print("[OK] Connection successful")
            print(f"     Database: {db_name}")
            print(f"     Server:   {version.split(',')[0]}")

            # Check whether the users table exists and how many rows it has.
            exists = conn.execute(
                text(
                    "SELECT EXISTS (SELECT FROM information_schema.tables "
                    "WHERE table_name = 'users')"
                )
            ).scalar_one()

            if exists:
                count = conn.execute(text("SELECT count(*) FROM users")).scalar_one()
                print(f"[OK] 'users' table exists ({count} row(s))")
            else:
                print("[WARN] 'users' table does NOT exist - run migrations: alembic upgrade head")

        return 0
    except Exception as exc:  # noqa: BLE001 - we want to report any failure clearly
        print(f"[FAIL] Could not connect: {type(exc).__name__}: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
