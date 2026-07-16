from pydantic import BaseModel


class SkillWritingStats(BaseModel):
    attempts: int
    avg_band: float | None
    today: int


class SkillSpeakingStats(BaseModel):
    attempts: int
    avg_band: float | None
    today: int


class SkillReadingStats(BaseModel):
    attempts: int
    avg_percentage: float | None
    today: int


class SkillListeningStats(BaseModel):
    attempts: int
    avg_percentage: float | None
    today: int


class SkillVocabStats(BaseModel):
    learning: int
    due: int
    mastered: int
    today: int


class SkillsBreakdown(BaseModel):
    writing: SkillWritingStats
    speaking: SkillSpeakingStats
    reading: SkillReadingStats
    listening: SkillListeningStats
    vocab: SkillVocabStats


class WeakArea(BaseModel):
    area: str
    question_type: str
    miss_rate: float
    missed: int
    total: int
    recommendation: str


class DailyGoal(BaseModel):
    skill: str
    label: str
    target: int
    completed: int


class WeeklyPlanDay(BaseModel):
    day: str
    tasks: list[str]


class ProgressDashboard(BaseModel):
    streak_days: int
    estimated_band: float | None
    skills: SkillsBreakdown
    weak_areas: list[WeakArea]
    recommendations: list[str]
    daily_goals: list[DailyGoal]
    goals_completed_today: int
    goals_total_today: int
    days_to_exam: int | None
    target_exam: str | None
    target_score: str | None
    exam_date: str | None
    weekly_plan: list[WeeklyPlanDay]
    focus_skills: list[str]
    disclaimer: str


class StudyPlanResponse(BaseModel):
    days_to_exam: int | None
    exam_date: str | None
    target_exam: str | None
    target_score: str | None
    weekly_plan: list[WeeklyPlanDay]
    daily_goals: list[DailyGoal]
    focus_skills: list[str]
