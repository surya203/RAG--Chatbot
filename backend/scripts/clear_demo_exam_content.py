"""Remove seeded/demo exam content so admin-generated content can be tested cleanly."""

from sqlalchemy import text

from app.core import storage
from app.db.session import SessionLocal
from app.models.listening import ListeningExercise


def main() -> None:
    db = SessionLocal()
    try:
        audio_files = [
            row[0]
            for row in db.execute(
                text("SELECT audio_filename FROM listening_exercises")
            ).fetchall()
        ]

        # Attempts / progress first (FK dependents).
        for table in (
            "mock_attempts",
            "writing_attempts",
            "speaking_attempts",
            "reading_attempts",
            "listening_attempts",
            "vocab_user_progress",
        ):
            deleted = db.execute(text(f"DELETE FROM {table}")).rowcount
            print(f"deleted {table}: {deleted}")

        # Mocks before section content (FK references).
        deleted = db.execute(text("DELETE FROM mock_exams")).rowcount
        print(f"deleted mock_exams: {deleted}")

        # Questions cascade with passages/exercises, but clear explicitly if needed.
        for table in (
            "reading_questions",
            "listening_questions",
            "reading_passages",
            "listening_exercises",
            "writing_prompts",
            "speaking_prompts",
            "vocab_cards",
        ):
            deleted = db.execute(text(f"DELETE FROM {table}")).rowcount
            print(f"deleted {table}: {deleted}")

        db.commit()

        for name in audio_files:
            storage.delete_file(name)
            print(f"removed audio file: {name}")

        print("Done. Demo exam content cleared.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
