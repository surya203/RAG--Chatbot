"""Seed a sample IELTS listening exercise with a generated WAV audio file."""

import struct
import wave
from io import BytesIO

from app.core import storage
from app.db.session import SessionLocal
from app.models.exam_profile import EXAM_IELTS_ACADEMIC
from app.models.listening import ListeningExercise, ListeningQuestion
from app.models.reading import Q_MCQ, Q_SHORT, Q_TFNG
from app.models.user import ROLE_ADMIN, User

TRANSCRIPT = """Welcome to the university library orientation. The main reading room is open from 8 a.m. to 10 p.m. on weekdays, and from 10 a.m. to 6 p.m. on weekends. Students can borrow up to ten books at a time for three weeks. Late returns incur a small daily fine. Group study rooms on the second floor must be booked online at least one day in advance. Printing and scanning services are available near the entrance, and staff are happy to help with research databases."""

QUESTIONS = [
    {
        "order_index": 0,
        "question_type": Q_TFNG,
        "question_text": "The library reading room closes at 10 p.m. on weekdays.",
        "options": ["True", "False", "Not Given"],
        "correct_answer": "True",
        "explanation": "The transcript states weekday hours are 8 a.m. to 10 p.m.",
    },
    {
        "order_index": 1,
        "question_type": Q_TFNG,
        "question_text": "Students may keep borrowed books for one month.",
        "options": ["True", "False", "Not Given"],
        "correct_answer": "False",
        "explanation": "The loan period is three weeks, not one month.",
    },
    {
        "order_index": 2,
        "question_type": Q_MCQ,
        "question_text": "How many books can a student borrow at once?",
        "options": ["Five", "Eight", "Ten", "Twelve"],
        "correct_answer": "Ten",
        "explanation": "The speaker says students can borrow up to ten books.",
    },
    {
        "order_index": 3,
        "question_type": Q_SHORT,
        "question_text": "Where are the group study rooms located?",
        "options": None,
        "correct_answer": "second floor|the second floor",
        "explanation": "Group study rooms are on the second floor.",
    },
]

VOCABULARY = [
    {"word": "orientation", "definition": "An introduction session for new users or members."},
    {"word": "incur", "definition": "To become subject to something, such as a fine or penalty."},
    {"word": "database", "definition": "An organised collection of information, often searchable online."},
]


def _make_demo_wav(seconds: float = 3.0, sample_rate: int = 22050) -> bytes:
    """Generate a short sine-tone WAV so playback works without external files."""
    freq = 440.0
    n_samples = int(sample_rate * seconds)
    buf = BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        frames = bytearray()
        for i in range(n_samples):
            value = int(16000 * (i / n_samples))  # rising tone envelope
            sample = int(value * __import__("math").sin(2 * 3.14159 * freq * i / sample_rate))
            frames.extend(struct.pack("<h", sample))
        wf.writeframes(frames)
    return buf.getvalue()


def seed_listening_exercises() -> None:
    db = SessionLocal()
    try:
        title = "University library orientation"
        existing = (
            db.query(ListeningExercise)
            .filter(
                ListeningExercise.title == title,
                ListeningExercise.exam == EXAM_IELTS_ACADEMIC,
            )
            .first()
        )
        if existing:
            print("Listening exercise already present.")
            return

        admin = db.query(User).filter(User.role == ROLE_ADMIN).first()
        audio_name = storage.generate_audio_filename("demo.wav")
        storage.save_file(audio_name, _make_demo_wav())

        exercise = ListeningExercise(
            created_by=admin.id if admin else None,
            exam=EXAM_IELTS_ACADEMIC,
            title=title,
            audio_filename=audio_name,
            audio_content_type="audio/wav",
            transcript=TRANSCRIPT,
            vocabulary=VOCABULARY,
            topic="Education",
            difficulty="medium",
            time_limit_minutes=10,
            replay_limit=2,
            strategy_tip=(
                "Listen once for the gist, then use replays for detail questions. "
                "Note numbers, times, and locations carefully."
            ),
            is_published=True,
        )
        db.add(exercise)
        db.flush()
        for q in QUESTIONS:
            db.add(ListeningQuestion(exercise_id=exercise.id, **q))
        db.commit()
        print(f"Seeded listening exercise with {len(QUESTIONS)} questions.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_listening_exercises()
