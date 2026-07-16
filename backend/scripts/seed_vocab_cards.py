"""Seed IELTS academic vocabulary cards for Phase 5."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import SessionLocal
from app.models.exam_profile import EXAM_IELTS_ACADEMIC
from app.models.user import User
from app.models.vocab import VocabCard

CARDS = [
    {
        "topic": "education",
        "word": "curriculum",
        "definition": "The subjects and content taught in a school or course.",
        "example_sentence": "The university updated its science curriculum last year.",
        "collocations": ["school curriculum", "national curriculum"],
    },
    {
        "topic": "education",
        "word": "literacy",
        "definition": "The ability to read and write.",
        "example_sentence": "Digital literacy is now essential for most careers.",
        "collocations": ["literacy rate", "financial literacy"],
    },
    {
        "topic": "environment",
        "word": "sustainable",
        "definition": "Able to continue without damaging the environment.",
        "example_sentence": "Cities are investing in sustainable transport systems.",
        "collocations": ["sustainable development", "sustainable energy"],
    },
    {
        "topic": "environment",
        "word": "biodiversity",
        "definition": "The variety of plant and animal life in a habitat.",
        "example_sentence": "Deforestation threatens local biodiversity.",
        "collocations": ["loss of biodiversity", "protect biodiversity"],
    },
    {
        "topic": "technology",
        "word": "innovation",
        "definition": "A new idea, method, or invention.",
        "example_sentence": "Innovation in healthcare has improved patient outcomes.",
        "collocations": ["technological innovation", "drive innovation"],
    },
    {
        "topic": "technology",
        "word": "automation",
        "definition": "The use of machines to do work previously done by people.",
        "example_sentence": "Automation may replace repetitive manual jobs.",
        "collocations": ["industrial automation", "automation of tasks"],
    },
    {
        "topic": "health",
        "word": "epidemic",
        "definition": "A widespread occurrence of a disease in a community.",
        "example_sentence": "Governments responded quickly to the flu epidemic.",
        "collocations": ["global epidemic", "obesity epidemic"],
    },
    {
        "topic": "health",
        "word": "nutrition",
        "definition": "The process of obtaining food needed for health and growth.",
        "example_sentence": "Good nutrition is vital during childhood.",
        "collocations": ["balanced nutrition", "poor nutrition"],
    },
    {
        "topic": "work",
        "word": "productivity",
        "definition": "The rate at which work is completed effectively.",
        "example_sentence": "Remote work can increase productivity for some employees.",
        "collocations": ["labour productivity", "boost productivity"],
    },
    {
        "topic": "work",
        "word": "redundancy",
        "definition": "The situation when a job is no longer needed and an employee loses work.",
        "example_sentence": "Several staff faced redundancy after the merger.",
        "collocations": ["face redundancy", "redundancy payment"],
    },
    {
        "topic": "travel",
        "word": "itinerary",
        "definition": "A planned route or schedule for a journey.",
        "example_sentence": "Our itinerary includes three cities in one week.",
        "collocations": ["travel itinerary", "detailed itinerary"],
    },
    {
        "topic": "travel",
        "word": "accommodation",
        "definition": "A place to live or stay, especially when travelling.",
        "example_sentence": "Student accommodation near campus is limited.",
        "collocations": ["book accommodation", "temporary accommodation"],
    },
    {
        "topic": "culture",
        "word": "heritage",
        "definition": "Valued traditions and buildings passed from past generations.",
        "example_sentence": "The temple is part of the nation's cultural heritage.",
        "collocations": ["cultural heritage", "world heritage site"],
    },
    {
        "topic": "culture",
        "word": "assimilation",
        "definition": "The process of becoming part of a different cultural group.",
        "example_sentence": "Language skills help immigrants with social assimilation.",
        "collocations": ["cultural assimilation", "rapid assimilation"],
    },
    {
        "topic": "science",
        "word": "hypothesis",
        "definition": "An idea suggested as a starting point for research.",
        "example_sentence": "The experiment tested the scientist's hypothesis.",
        "collocations": ["test a hypothesis", "form a hypothesis"],
    },
    {
        "topic": "science",
        "word": "phenomenon",
        "definition": "Something that exists and can be observed or studied.",
        "example_sentence": "Climate change is a global phenomenon.",
        "collocations": ["natural phenomenon", "rare phenomenon"],
    },
    {
        "topic": "general",
        "word": "significant",
        "definition": "Important or large enough to be noticed.",
        "example_sentence": "There was a significant increase in applications.",
        "collocations": ["significant impact", "statistically significant"],
    },
    {
        "topic": "general",
        "word": "consequently",
        "definition": "As a result; therefore.",
        "example_sentence": "Costs rose; consequently, fewer students enrolled.",
        "collocations": [],
    },
    {
        "topic": "general",
        "word": "allocate",
        "definition": "To distribute resources for a particular purpose.",
        "example_sentence": "The government will allocate funds to rural schools.",
        "collocations": ["allocate resources", "allocate funding"],
    },
    {
        "topic": "general",
        "word": "prevalent",
        "definition": "Widespread or common in a particular place or time.",
        "example_sentence": "Smartphone use is prevalent among teenagers.",
        "collocations": ["highly prevalent", "become prevalent"],
    },
]


def main() -> None:
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == "admin@example.com").first()
        existing = (
            db.query(VocabCard)
            .filter(VocabCard.exam == EXAM_IELTS_ACADEMIC)
            .count()
        )
        if existing >= len(CARDS):
            print(f"Already have {existing} vocab cards; skipping seed.")
            return

        for item in CARDS:
            dup = (
                db.query(VocabCard)
                .filter(
                    VocabCard.exam == EXAM_IELTS_ACADEMIC,
                    VocabCard.word == item["word"],
                )
                .first()
            )
            if dup:
                continue
            db.add(
                VocabCard(
                    created_by=admin.id if admin else None,
                    exam=EXAM_IELTS_ACADEMIC,
                    topic=item["topic"],
                    word=item["word"],
                    definition=item["definition"],
                    example_sentence=item["example_sentence"],
                    collocations=item.get("collocations") or None,
                    is_published=True,
                )
            )
        db.commit()
        total = (
            db.query(VocabCard)
            .filter(VocabCard.exam == EXAM_IELTS_ACADEMIC)
            .count()
        )
        print(f"Seeded vocab cards. Total IELTS Academic cards: {total}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
