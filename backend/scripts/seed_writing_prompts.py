"""Seed a starter set of IELTS writing prompts (admin content)."""

from app.db.session import SessionLocal
from app.models.exam_profile import EXAM_IELTS_ACADEMIC
from app.models.user import ROLE_ADMIN, User
from app.models.writing import TASK_IELTS_TASK1, TASK_IELTS_TASK2, WritingPrompt

SEED_PROMPTS = [
    {
        "exam": EXAM_IELTS_ACADEMIC,
        "task_type": TASK_IELTS_TASK2,
        "title": "Technology in education",
        "topic": "Education",
        "time_limit_minutes": 40,
        "min_words": 250,
        "prompt_text": (
            "Some people believe that technology has made learning easier and more "
            "accessible, while others think it has reduced students' ability to think "
            "critically.\n\nDiscuss both views and give your own opinion.\n\n"
            "Write at least 250 words."
        ),
    },
    {
        "exam": EXAM_IELTS_ACADEMIC,
        "task_type": TASK_IELTS_TASK2,
        "title": "Environmental responsibility",
        "topic": "Environment",
        "time_limit_minutes": 40,
        "min_words": 250,
        "prompt_text": (
            "Many people believe that individuals can do little to improve the "
            "environment, and that only governments and large companies can make a "
            "real difference.\n\nTo what extent do you agree or disagree?\n\n"
            "Write at least 250 words."
        ),
    },
    {
        "exam": EXAM_IELTS_ACADEMIC,
        "task_type": TASK_IELTS_TASK2,
        "title": "Working from home",
        "topic": "Work",
        "time_limit_minutes": 40,
        "min_words": 250,
        "prompt_text": (
            "An increasing number of people are choosing to work from home rather "
            "than commute to an office.\n\nDo the advantages of this outweigh the "
            "disadvantages?\n\nWrite at least 250 words."
        ),
    },
    {
        "exam": EXAM_IELTS_ACADEMIC,
        "task_type": TASK_IELTS_TASK1,
        "title": "Line graph: Internet usage",
        "topic": "Data description",
        "time_limit_minutes": 20,
        "min_words": 150,
        "prompt_text": (
            "The line graph below shows the percentage of households with Internet "
            "access in three countries between 2000 and 2020.\n\n"
            "(Imagine a graph where Country A rises from 20% to 90%, Country B from "
            "35% to 85%, and Country C from 10% to 70%.)\n\n"
            "Summarise the information by selecting and reporting the main features, "
            "and make comparisons where relevant.\n\nWrite at least 150 words."
        ),
    },
    {
        "exam": EXAM_IELTS_ACADEMIC,
        "task_type": TASK_IELTS_TASK1,
        "title": "Bar chart: University subjects",
        "topic": "Data description",
        "time_limit_minutes": 20,
        "min_words": 150,
        "prompt_text": (
            "The bar chart compares the number of male and female students studying "
            "four university subjects (Engineering, Business, Medicine, and Arts) "
            "in 2022.\n\n"
            "(Imagine: Engineering — 800 men / 300 women; Business — 600 / 650; "
            "Medicine — 400 / 700; Arts — 250 / 550.)\n\n"
            "Summarise the information by selecting and reporting the main features, "
            "and make comparisons where relevant.\n\nWrite at least 150 words."
        ),
    },
]


def seed_writing_prompts() -> None:
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.role == ROLE_ADMIN).first()
        created = 0
        for item in SEED_PROMPTS:
            exists = (
                db.query(WritingPrompt)
                .filter(WritingPrompt.title == item["title"], WritingPrompt.exam == item["exam"])
                .first()
            )
            if exists:
                continue
            db.add(
                WritingPrompt(
                    created_by=admin.id if admin else None,
                    is_published=True,
                    **item,
                )
            )
            created += 1
        db.commit()
        print(f"Seeded {created} writing prompts "
              f"({len(SEED_PROMPTS) - created} already present).")
    finally:
        db.close()


if __name__ == "__main__":
    seed_writing_prompts()
