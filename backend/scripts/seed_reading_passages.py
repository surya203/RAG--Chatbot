"""Seed a sample IELTS Academic reading passage + questions."""

from app.db.session import SessionLocal
from app.models.exam_profile import EXAM_IELTS_ACADEMIC
from app.models.reading import (
    Q_MCQ,
    Q_SHORT,
    Q_TFNG,
    ReadingPassage,
    ReadingQuestion,
)
from app.models.user import ROLE_ADMIN, User

PASSAGE_TEXT = """Urban Greening and Wellbeing

Cities around the world are investing in green spaces — parks, rooftop gardens, and tree-lined streets — not only for beauty but for public health. Research over the past two decades suggests that access to nature in urban environments can reduce stress, improve concentration, and encourage physical activity.

One well-known study in Tokyo found that residents who lived within walking distance of a park reported lower levels of fatigue than those who did not. Similar patterns have been observed in European cities, where street trees are linked with cooler summer temperatures and fewer heat-related hospital visits. However, researchers caution that correlation does not always mean causation: wealthier neighbourhoods often have both more greenery and better healthcare access.

Critics of large greening projects argue that they can increase housing costs nearby, a process sometimes called 'green gentrification'. When a neglected canal is transformed into an attractive promenade, property prices may rise and long-term residents can be displaced. Urban planners therefore emphasise equitable distribution of green spaces rather than concentrating investment only in already popular districts.

Despite these challenges, most experts agree that carefully designed green infrastructure remains one of the most cost-effective tools for improving city life. Combining tree planting with community gardens and safe walking paths can serve climate, health, and social goals at the same time.
"""

QUESTIONS = [
    {
        "order_index": 0,
        "question_type": Q_TFNG,
        "question_text": "Access to urban nature has been linked with reduced stress.",
        "options": ["True", "False", "Not Given"],
        "correct_answer": "True",
        "explanation": "Paragraph 1 states access to nature can reduce stress.",
    },
    {
        "order_index": 1,
        "question_type": Q_TFNG,
        "question_text": "The Tokyo study proved that parks directly cause better health outcomes.",
        "options": ["True", "False", "Not Given"],
        "correct_answer": "False",
        "explanation": "Paragraph 2 warns correlation is not always causation.",
    },
    {
        "order_index": 2,
        "question_type": Q_TFNG,
        "question_text": "Green gentrification always reduces housing supply in a city.",
        "options": ["True", "False", "Not Given"],
        "correct_answer": "Not Given",
        "explanation": "The text mentions rising prices and displacement, not housing supply.",
    },
    {
        "order_index": 3,
        "question_type": Q_MCQ,
        "question_text": "According to the passage, critics worry that greening projects may:",
        "options": [
            "Reduce summer temperatures too much",
            "Raise nearby housing costs",
            "Decrease the number of street trees",
            "Replace community gardens with highways",
        ],
        "correct_answer": "Raise nearby housing costs",
        "explanation": "Paragraph 3 discusses green gentrification and rising property prices.",
    },
    {
        "order_index": 4,
        "question_type": Q_MCQ,
        "question_text": "Most experts consider green infrastructure to be:",
        "options": [
            "Too expensive for most cities",
            "A cost-effective improvement tool",
            "Useful only for tourism",
            "Harmful to concentration",
        ],
        "correct_answer": "A cost-effective improvement tool",
        "explanation": "Final paragraph: carefully designed green infrastructure is cost-effective.",
    },
    {
        "order_index": 5,
        "question_type": Q_SHORT,
        "question_text": "What term describes rising housing costs after greening improves an area?",
        "options": None,
        "correct_answer": "green gentrification|gentrification",
        "explanation": "Paragraph 3 introduces the term green gentrification.",
    },
]


def seed_reading_passages() -> None:
    db = SessionLocal()
    try:
        title = "Urban Greening and Wellbeing"
        existing = (
            db.query(ReadingPassage)
            .filter(ReadingPassage.title == title, ReadingPassage.exam == EXAM_IELTS_ACADEMIC)
            .first()
        )
        if existing:
            print("Reading passage already present.")
            return

        admin = db.query(User).filter(User.role == ROLE_ADMIN).first()
        passage = ReadingPassage(
            created_by=admin.id if admin else None,
            exam=EXAM_IELTS_ACADEMIC,
            title=title,
            passage_text=PASSAGE_TEXT.strip(),
            topic="Environment / Cities",
            difficulty="medium",
            time_limit_minutes=20,
            strategy_tip=(
                "For True/False/Not Given: True = clearly stated; False = contradicts the text; "
                "Not Given = cannot be confirmed from the passage. Do not use outside knowledge."
            ),
            is_published=True,
        )
        db.add(passage)
        db.flush()
        for q in QUESTIONS:
            db.add(ReadingQuestion(passage_id=passage.id, **q))
        db.commit()
        print(f"Seeded reading passage with {len(QUESTIONS)} questions.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_reading_passages()
