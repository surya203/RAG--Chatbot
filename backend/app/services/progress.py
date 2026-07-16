"""Aggregate practice stats, streaks, weak areas, and study plans."""

from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.exam_profile import ExamProfile
from app.models.listening import ListeningAttempt
from app.models.reading import ReadingAttempt
from app.models.speaking import SpeakingAttempt
from app.models.vocab import VocabUserProgress
from app.models.writing import WritingAttempt

SKILLS = ("writing", "speaking", "reading", "listening", "vocab")

DAILY_GOALS = {
    "vocab_reviews": 10,
    "reading_passages": 1,
    "listening_exercises": 1,
    "writing_tasks": 1,
    "speaking_tasks": 1,
}

QUESTION_TYPE_LABELS = {
    "true_false_not_given": "True / False / Not Given",
    "yes_no_not_given": "Yes / No / Not Given",
    "multiple_choice": "Multiple choice",
    "matching_headings": "Matching headings",
    "short_answer": "Short answer",
    "fill_blank": "Fill in the blank",
}


def _utc_today() -> date:
    return datetime.now(timezone.utc).date()


def _activity_dates(db: Session, user_id) -> set[date]:
    """Collect calendar dates on which the student practiced any skill."""
    dates: set[date] = set()

    for model in (
        WritingAttempt,
        SpeakingAttempt,
        ReadingAttempt,
        ListeningAttempt,
    ):
        rows = (
            db.query(model.created_at)
            .filter(model.user_id == user_id)
            .order_by(model.created_at.desc())
            .limit(200)
            .all()
        )
        for (ts,) in rows:
            if ts:
                dates.add(ts.date())

    vocab_rows = (
        db.query(VocabUserProgress.last_reviewed_at)
        .filter(
            VocabUserProgress.user_id == user_id,
            VocabUserProgress.last_reviewed_at.isnot(None),
        )
        .limit(500)
        .all()
    )
    for (ts,) in vocab_rows:
        if ts:
            dates.add(ts.date())

    return dates


def compute_streak(db: Session, user_id) -> int:
    dates = _activity_dates(db, user_id)
    if not dates:
        return 0

    streak = 0
    day = _utc_today()
    # Allow streak to count if practiced today or yesterday (grace for timezone).
    if day not in dates and (day - timedelta(days=1)) not in dates:
        return 0

    if day not in dates:
        day -= timedelta(days=1)

    while day in dates:
        streak += 1
        day -= timedelta(days=1)

    return streak


def _count_today(db: Session, user_id, model, extra_filter=None) -> int:
    today = _utc_today()
    q = db.query(model).filter(model.user_id == user_id)
    if extra_filter is not None:
        q = extra_filter(q)
    return sum(1 for row in q.all() if row.created_at and row.created_at.date() == today)


def _vocab_reviews_today(db: Session, user_id) -> int:
    today = _utc_today()
    rows = (
        db.query(VocabUserProgress.last_reviewed_at)
        .filter(
            VocabUserProgress.user_id == user_id,
            VocabUserProgress.last_reviewed_at.isnot(None),
        )
        .all()
    )
    return sum(1 for (ts,) in rows if ts and ts.date() == today)


def _skill_stats(db: Session, user_id, exam: str | None) -> dict:
    def _avg_band(model):
        q = db.query(model.overall_band).filter(
            model.user_id == user_id,
            model.overall_band.isnot(None),
        )
        if exam:
            q = q.filter(model.exam == exam)
        bands = [b for (b,) in q.order_by(model.created_at.desc()).limit(20).all()]
        if not bands:
            return None, 0
        return round(sum(bands) / len(bands), 1), len(bands)

    def _avg_pct(model):
        q = db.query(model.percentage).filter(model.user_id == user_id)
        if exam:
            q = q.filter(model.exam == exam)
        pcts = [p for (p,) in q.order_by(model.created_at.desc()).limit(20).all()]
        if not pcts:
            return None, 0
        return round(sum(pcts) / len(pcts), 1), len(pcts)

    w_band, w_count = _avg_band(WritingAttempt)
    s_band, s_count = _avg_band(SpeakingAttempt)
    r_pct, r_count = _avg_pct(ReadingAttempt)
    l_pct, l_count = _avg_pct(ListeningAttempt)

    vocab_learning = (
        db.query(VocabUserProgress)
        .filter(VocabUserProgress.user_id == user_id)
        .count()
    )
    vocab_due = (
        db.query(VocabUserProgress)
        .filter(
            VocabUserProgress.user_id == user_id,
            VocabUserProgress.next_review_at <= datetime.now(timezone.utc),
            VocabUserProgress.status != "mastered",
        )
        .count()
    )
    vocab_mastered = (
        db.query(VocabUserProgress)
        .filter(
            VocabUserProgress.user_id == user_id,
            VocabUserProgress.status == "mastered",
        )
        .count()
    )

    return {
        "writing": {
            "attempts": w_count,
            "avg_band": w_band,
            "today": _count_today(db, user_id, WritingAttempt),
        },
        "speaking": {
            "attempts": s_count,
            "avg_band": s_band,
            "today": _count_today(db, user_id, SpeakingAttempt),
        },
        "reading": {
            "attempts": r_count,
            "avg_percentage": r_pct,
            "today": _count_today(db, user_id, ReadingAttempt),
        },
        "listening": {
            "attempts": l_count,
            "avg_percentage": l_pct,
            "today": _count_today(db, user_id, ListeningAttempt),
        },
        "vocab": {
            "learning": vocab_learning,
            "due": vocab_due,
            "mastered": vocab_mastered,
            "today": _vocab_reviews_today(db, user_id),
        },
    }


def _weak_areas(db: Session, user_id) -> list[dict]:
    """Top question types missed in reading/listening attempts."""
    misses: Counter[str] = Counter()
    totals: Counter[str] = Counter()

    for model in (ReadingAttempt, ListeningAttempt):
        attempts = (
            db.query(model)
            .filter(model.user_id == user_id)
            .order_by(model.created_at.desc())
            .limit(30)
            .all()
        )
        for attempt in attempts:
            for item in attempt.results or []:
                qtype = item.get("question_type", "unknown")
                totals[qtype] += 1
                if not item.get("is_correct"):
                    misses[qtype] += 1

    weak: list[dict] = []
    for qtype, miss_count in misses.most_common(5):
        total = totals[qtype]
        if total < 2:
            continue
        rate = round((miss_count / total) * 100, 1)
        if rate < 40:
            continue
        weak.append(
            {
                "area": QUESTION_TYPE_LABELS.get(qtype, qtype.replace("_", " ")),
                "question_type": qtype,
                "miss_rate": rate,
                "missed": miss_count,
                "total": total,
                "recommendation": f"Practice more {QUESTION_TYPE_LABELS.get(qtype, qtype)} questions",
            }
        )
    return weak[:4]


def _writing_weaknesses(db: Session, user_id) -> list[str]:
    attempts = (
        db.query(WritingAttempt)
        .filter(
            WritingAttempt.user_id == user_id,
            WritingAttempt.feedback.isnot(None),
        )
        .order_by(WritingAttempt.created_at.desc())
        .limit(10)
        .all()
    )
    criteria_scores: dict[str, list[float]] = defaultdict(list)
    for att in attempts:
        criteria = (att.feedback or {}).get("criteria") or {}
        for name, data in criteria.items():
            if isinstance(data, dict) and data.get("score") is not None:
                criteria_scores[name].append(float(data["score"]))

    tips: list[str] = []
    for name, scores in sorted(
        criteria_scores.items(), key=lambda x: sum(x[1]) / len(x[1])
    ):
        avg = sum(scores) / len(scores)
        if avg < 6.0:
            label = name.replace("_", " ").title()
            tips.append(f"Focus on {label} in Writing (recent avg {avg:.1f})")
        if len(tips) >= 2:
            break
    return tips


def _estimate_overall_band(skills: dict, exam: str) -> float | None:
    parts: list[float] = []
    if skills["writing"]["avg_band"] is not None:
        parts.append(skills["writing"]["avg_band"])
    if skills["speaking"]["avg_band"] is not None:
        parts.append(skills["speaking"]["avg_band"])
    if skills["reading"]["avg_percentage"] is not None:
        parts.append(skills["reading"]["avg_percentage"] / 12.5)
    if skills["listening"]["avg_percentage"] is not None:
        parts.append(skills["listening"]["avg_percentage"] / 12.5)
    if not parts:
        return None
    return round(sum(parts) / len(parts), 1)


def build_study_plan(
    profile: ExamProfile | None,
    skills: dict,
    weak_areas: list[dict],
    writing_tips: list[str],
) -> dict:
    today = _utc_today()
    days_to_exam = None
    if profile and profile.exam_date:
        days_to_exam = max(0, (profile.exam_date - today).days)

    # Rank skills by weakness (lower score = higher priority).
    skill_priority: list[tuple[str, float]] = []
    if skills["writing"]["avg_band"] is not None:
        skill_priority.append(("writing", skills["writing"]["avg_band"]))
    else:
        skill_priority.append(("writing", 0.0))
    if skills["speaking"]["avg_band"] is not None:
        skill_priority.append(("speaking", skills["speaking"]["avg_band"]))
    else:
        skill_priority.append(("speaking", 0.0))
    if skills["reading"]["avg_percentage"] is not None:
        skill_priority.append(("reading", skills["reading"]["avg_percentage"] / 12.5))
    else:
        skill_priority.append(("reading", 0.0))
    if skills["listening"]["avg_percentage"] is not None:
        skill_priority.append(("listening", skills["listening"]["avg_percentage"] / 12.5))
    else:
        skill_priority.append(("listening", 0.0))
    skill_priority.sort(key=lambda x: x[1])

    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    weekly_plan: list[dict] = []

    task_templates = {
        "writing": "Complete 1 Writing Coach task",
        "speaking": "Record 1 Speaking Coach response",
        "reading": "Finish 1 timed Reading passage",
        "listening": "Complete 1 Listening exercise",
        "vocab": f"Review {DAILY_GOALS['vocab_reviews']} vocabulary flashcards",
    }

    for i, day_label in enumerate(day_names):
        tasks: list[str] = [task_templates["vocab"]]
        # Rotate focus skill across the week based on weakness order.
        focus_skill = skill_priority[i % len(skill_priority)][0]
        tasks.append(task_templates[focus_skill])
        if weak_areas and i < len(weak_areas):
            tasks.append(weak_areas[i]["recommendation"])
        if writing_tips and focus_skill == "writing" and writing_tips:
            tasks.append(writing_tips[0])
        weekly_plan.append({"day": day_label, "tasks": tasks[:4]})

    daily_goals = [
        {
            "skill": "vocab",
            "label": "Vocabulary reviews",
            "target": DAILY_GOALS["vocab_reviews"],
            "completed": skills["vocab"]["today"],
        },
        {
            "skill": "reading",
            "label": "Reading passages",
            "target": DAILY_GOALS["reading_passages"],
            "completed": skills["reading"]["today"],
        },
        {
            "skill": "listening",
            "label": "Listening exercises",
            "target": DAILY_GOALS["listening_exercises"],
            "completed": skills["listening"]["today"],
        },
        {
            "skill": "writing",
            "label": "Writing tasks",
            "target": DAILY_GOALS["writing_tasks"],
            "completed": skills["writing"]["today"],
        },
        {
            "skill": "speaking",
            "label": "Speaking tasks",
            "target": DAILY_GOALS["speaking_tasks"],
            "completed": skills["speaking"]["today"],
        },
    ]

    return {
        "days_to_exam": days_to_exam,
        "exam_date": profile.exam_date.isoformat() if profile and profile.exam_date else None,
        "target_exam": profile.target_exam if profile else None,
        "target_score": profile.target_score if profile else None,
        "weekly_plan": weekly_plan,
        "daily_goals": daily_goals,
        "focus_skills": [s for s, _ in skill_priority[:2]],
    }


def build_study_plan_for_user(db: Session, user_id, profile: ExamProfile | None) -> dict:
    exam = profile.target_exam if profile else None
    skills = _skill_stats(db, user_id, exam)
    weak_areas = _weak_areas(db, user_id)
    writing_tips = _writing_weaknesses(db, user_id)
    return build_study_plan(profile, skills, weak_areas, writing_tips)


def build_dashboard(db: Session, user_id, profile: ExamProfile | None) -> dict:
    exam = profile.target_exam if profile else None
    skills = _skill_stats(db, user_id, exam)
    weak_areas = _weak_areas(db, user_id)
    writing_tips = _writing_weaknesses(db, user_id)
    streak = compute_streak(db, user_id)
    estimated_band = _estimate_overall_band(skills, exam or "")
    study_plan = build_study_plan(profile, skills, weak_areas, writing_tips)

    recommendations: list[str] = []
    for w in weak_areas[:2]:
        recommendations.append(w["recommendation"])
    recommendations.extend(writing_tips[:2])
    if skills["vocab"]["due"] > 0:
        recommendations.append(
            f"You have {skills['vocab']['due']} vocabulary cards due for review today"
        )
    if not recommendations:
        recommendations.append(
            "Complete practice across all four skills this week for balanced prep"
        )

    goals_met = sum(
        1 for g in study_plan["daily_goals"] if g["completed"] >= g["target"]
    )
    total_goals = len(study_plan["daily_goals"])

    return {
        "streak_days": streak,
        "estimated_band": estimated_band,
        "skills": skills,
        "weak_areas": weak_areas,
        "recommendations": recommendations[:5],
        "daily_goals": study_plan["daily_goals"],
        "goals_completed_today": goals_met,
        "goals_total_today": total_goals,
        "days_to_exam": study_plan["days_to_exam"],
        "target_exam": study_plan["target_exam"],
        "target_score": study_plan["target_score"],
        "exam_date": study_plan["exam_date"],
        "weekly_plan": study_plan["weekly_plan"],
        "focus_skills": study_plan["focus_skills"],
        "disclaimer": "AI band estimates are guidance only, not official exam scores.",
    }
