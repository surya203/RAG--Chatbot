"""Seed IELTS speaking prompts for Phase 2."""

from app.db.session import SessionLocal
from app.models.exam_profile import EXAM_IELTS_ACADEMIC
from app.models.speaking import (
    TASK_IELTS_PART1,
    TASK_IELTS_PART2,
    TASK_IELTS_PART3,
    SpeakingPrompt,
)
from app.models.user import ROLE_ADMIN, User

SEED = [
    {
        "exam": EXAM_IELTS_ACADEMIC,
        "task_type": TASK_IELTS_PART1,
        "title": "Hometown & daily life",
        "topic": "Everyday",
        "prep_seconds": 0,
        "speak_seconds": 60,
        "prompt_text": (
            "Answer these Part 1 style questions naturally (about 45–60 seconds each topic):\n"
            "1. Where is your hometown?\n"
            "2. What do you like most about living there?\n"
            "3. How has your hometown changed in recent years?"
        ),
        "cue_points": None,
        "model_answer": (
            "I come from a mid-sized coastal city. What I like most is the walkable city centre "
            "and the sea breeze in the evenings. In the last decade it has become more touristy — "
            "there are new cafes and a tram line — but traffic has also increased."
        ),
    },
    {
        "exam": EXAM_IELTS_ACADEMIC,
        "task_type": TASK_IELTS_PART2,
        "title": "A skill you want to learn",
        "topic": "Skills",
        "prep_seconds": 60,
        "speak_seconds": 120,
        "prompt_text": (
            "Describe a skill you would like to learn.\n\n"
            "You should say:\n"
            "- what the skill is\n"
            "- why you want to learn it\n"
            "- how you would learn it\n"
            "- and explain how this skill would help you in the future.\n\n"
            "You have 1 minute to prepare. You will speak for 1–2 minutes."
        ),
        "cue_points": (
            "- what the skill is\n"
            "- why you want to learn it\n"
            "- how you would learn it\n"
            "- how it would help you later"
        ),
        "model_answer": (
            "I'd like to learn public speaking. I've always felt nervous presenting ideas, "
            "and better speaking skills would help at university and at work. I'd join a local "
            "club, practice short talks weekly, and record myself to improve fluency. In the "
            "future this could help me lead meetings and explain complex topics clearly."
        ),
    },
    {
        "exam": EXAM_IELTS_ACADEMIC,
        "task_type": TASK_IELTS_PART2,
        "title": "A place you enjoy visiting",
        "topic": "Places",
        "prep_seconds": 60,
        "speak_seconds": 120,
        "prompt_text": (
            "Describe a place you enjoy visiting.\n\n"
            "You should say:\n"
            "- where it is\n"
            "- how often you go there\n"
            "- what you do there\n"
            "- and explain why you enjoy visiting this place.\n\n"
            "You have 1 minute to prepare. You will speak for 1–2 minutes."
        ),
        "cue_points": (
            "- where it is\n"
            "- how often you go\n"
            "- what you do\n"
            "- why you enjoy it"
        ),
        "model_answer": (
            "One place I love is a riverside park near my flat. I go there most weekends, "
            "usually for a walk or to read outdoors. It feels quieter than the city centre, "
            "and I enjoy watching people fishing and cycling along the path."
        ),
    },
    {
        "exam": EXAM_IELTS_ACADEMIC,
        "task_type": TASK_IELTS_PART3,
        "title": "Learning skills discussion",
        "topic": "Education",
        "prep_seconds": 0,
        "speak_seconds": 90,
        "prompt_text": (
            "Part 3 discussion (give developed answers):\n"
            "1. Why do some people find it hard to learn new skills as adults?\n"
            "2. Should schools focus more on practical skills or academic knowledge?\n"
            "3. How might technology change the way people learn skills in the future?"
        ),
        "cue_points": None,
        "model_answer": (
            "Adults often struggle because of limited time and fear of making mistakes. "
            "Schools need a balance: academic knowledge builds thinking, while practical "
            "skills prepare students for real tasks. In the future, adaptive learning apps "
            "and VR practice could make skill training more personalised and accessible."
        ),
    },
]


def seed_speaking_prompts() -> None:
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.role == ROLE_ADMIN).first()
        created = 0
        for item in SEED:
            exists = (
                db.query(SpeakingPrompt)
                .filter(
                    SpeakingPrompt.title == item["title"],
                    SpeakingPrompt.exam == item["exam"],
                )
                .first()
            )
            if exists:
                continue
            db.add(
                SpeakingPrompt(
                    created_by=admin.id if admin else None,
                    is_published=True,
                    **item,
                )
            )
            created += 1
        db.commit()
        print(
            f"Seeded {created} speaking prompts "
            f"({len(SEED) - created} already present)."
        )
    finally:
        db.close()


if __name__ == "__main__":
    seed_speaking_prompts()
