"""Seed a full IELTS Academic mock exam from existing Phase 3–4 content."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import SessionLocal
from app.models.exam_profile import EXAM_IELTS_ACADEMIC
from app.models.listening import ListeningExercise
from app.models.mock_exam import MOCK_MODE_FULL, MockExam
from app.models.reading import ReadingPassage
from app.models.user import User
from app.models.writing import WritingPrompt


def main() -> None:
    db = SessionLocal()
    try:
        existing = (
            db.query(MockExam)
            .filter(
                MockExam.exam == EXAM_IELTS_ACADEMIC,
                MockExam.title == "IELTS Academic Mini Mock (Demo)",
            )
            .first()
        )
        if existing:
            print(f"Demo mock already exists: {existing.id}")
            return

        reading = (
            db.query(ReadingPassage)
            .filter(
                ReadingPassage.exam == EXAM_IELTS_ACADEMIC,
                ReadingPassage.is_published.is_(True),
            )
            .order_by(ReadingPassage.created_at.desc())
            .first()
        )
        listening = (
            db.query(ListeningExercise)
            .filter(
                ListeningExercise.exam == EXAM_IELTS_ACADEMIC,
                ListeningExercise.is_published.is_(True),
            )
            .order_by(ListeningExercise.created_at.desc())
            .first()
        )
        writing = (
            db.query(WritingPrompt)
            .filter(
                WritingPrompt.exam == EXAM_IELTS_ACADEMIC,
                WritingPrompt.is_published.is_(True),
            )
            .order_by(WritingPrompt.created_at.desc())
            .first()
        )

        if not reading and not listening and not writing:
            print("No published content found. Seed reading/listening/writing first.")
            return

        admin = db.query(User).filter(User.email == "admin@example.com").first()
        mock = MockExam(
            created_by=admin.id if admin else None,
            exam=EXAM_IELTS_ACADEMIC,
            title="IELTS Academic Mini Mock (Demo)",
            description=(
                "Timed multi-skill practice paper using published Reading, Listening, "
                "and Writing content. AI band estimates for Writing are guidance only."
            ),
            mode=MOCK_MODE_FULL,
            total_time_minutes=45,
            reading_passage_id=reading.id if reading else None,
            listening_exercise_id=listening.id if listening else None,
            writing_prompt_id=writing.id if writing else None,
            is_published=True,
        )
        db.add(mock)
        db.commit()
        db.refresh(mock)
        sections = []
        if reading:
            sections.append("reading")
        if listening:
            sections.append("listening")
        if writing:
            sections.append("writing")
        print(f"Seeded mock exam {mock.id} with sections: {', '.join(sections)}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
