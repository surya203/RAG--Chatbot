export type ExamKey =
  | "ielts_academic"
  | "ielts_general"
  | "toefl_ibt"
  | "pte_academic";

export type WritingTaskType =
  | "ielts_task1"
  | "ielts_task2"
  | "toefl_independent"
  | "toefl_integrated"
  | "pte_essay"
  | "pte_summarize_written_text";

export const EXAM_OPTIONS: { value: ExamKey; label: string }[] = [
  { value: "ielts_academic", label: "IELTS Academic" },
  { value: "ielts_general", label: "IELTS General" },
  { value: "toefl_ibt", label: "TOEFL iBT" },
  { value: "pte_academic", label: "PTE Academic" },
];

export const TASK_OPTIONS: { value: WritingTaskType; label: string; exams: ExamKey[] }[] = [
  { value: "ielts_task1", label: "IELTS Task 1", exams: ["ielts_academic", "ielts_general"] },
  { value: "ielts_task2", label: "IELTS Task 2", exams: ["ielts_academic", "ielts_general"] },
  { value: "toefl_independent", label: "TOEFL Independent", exams: ["toefl_ibt"] },
  { value: "toefl_integrated", label: "TOEFL Integrated", exams: ["toefl_ibt"] },
  { value: "pte_essay", label: "PTE Write Essay", exams: ["pte_academic"] },
  {
    value: "pte_summarize_written_text",
    label: "PTE Summarize Written Text",
    exams: ["pte_academic"],
  },
];

export interface ExamProfile {
  id: string;
  target_exam: ExamKey;
  target_score: string | null;
  exam_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExamProfileUpsert {
  target_exam: ExamKey;
  target_score?: string | null;
  exam_date?: string | null;
}

export interface WritingPrompt {
  id: string;
  exam: ExamKey;
  task_type: WritingTaskType;
  title: string;
  prompt_text: string;
  topic: string | null;
  time_limit_minutes: number;
  min_words: number | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface WritingPromptInput {
  exam: ExamKey;
  task_type: WritingTaskType;
  title: string;
  prompt_text: string;
  topic?: string | null;
  time_limit_minutes: number;
  min_words?: number | null;
  is_published: boolean;
}

export interface CriterionScore {
  score: number;
  feedback: string;
}

export interface WritingFeedback {
  overall_band: number;
  criteria: Record<string, CriterionScore>;
  strengths: string[];
  improvements: string[];
  improved_paragraph: string;
  disclaimer?: string;
}

export interface WritingAttempt {
  id: string;
  prompt_id: string | null;
  exam: ExamKey;
  task_type: WritingTaskType;
  prompt_text: string;
  essay_text: string;
  word_count: number;
  time_spent_seconds: number | null;
  overall_band: number | null;
  feedback: WritingFeedback | null;
  created_at: string;
}

export interface WritingAttemptSummary {
  id: string;
  exam: ExamKey;
  task_type: WritingTaskType;
  prompt_text: string;
  word_count: number;
  overall_band: number | null;
  created_at: string;
}

export interface SubmitWritingAttempt {
  prompt_id?: string | null;
  exam?: ExamKey;
  task_type?: WritingTaskType;
  prompt_text?: string;
  essay_text: string;
  time_spent_seconds?: number | null;
}

export type SpeakingTaskType =
  | "ielts_part1"
  | "ielts_part2"
  | "ielts_part3"
  | "toefl_independent_speaking"
  | "toefl_integrated_speaking"
  | "pte_describe_image"
  | "pte_retell_lecture";

export const SPEAKING_TASK_OPTIONS: {
  value: SpeakingTaskType;
  label: string;
  exams: ExamKey[];
  defaultPrep: number;
  defaultSpeak: number;
}[] = [
  {
    value: "ielts_part1",
    label: "IELTS Part 1",
    exams: ["ielts_academic", "ielts_general"],
    defaultPrep: 0,
    defaultSpeak: 60,
  },
  {
    value: "ielts_part2",
    label: "IELTS Part 2 (Cue card)",
    exams: ["ielts_academic", "ielts_general"],
    defaultPrep: 60,
    defaultSpeak: 120,
  },
  {
    value: "ielts_part3",
    label: "IELTS Part 3",
    exams: ["ielts_academic", "ielts_general"],
    defaultPrep: 0,
    defaultSpeak: 90,
  },
  {
    value: "toefl_independent_speaking",
    label: "TOEFL Independent Speaking",
    exams: ["toefl_ibt"],
    defaultPrep: 15,
    defaultSpeak: 45,
  },
  {
    value: "toefl_integrated_speaking",
    label: "TOEFL Integrated Speaking",
    exams: ["toefl_ibt"],
    defaultPrep: 30,
    defaultSpeak: 60,
  },
  {
    value: "pte_describe_image",
    label: "PTE Describe Image",
    exams: ["pte_academic"],
    defaultPrep: 25,
    defaultSpeak: 40,
  },
  {
    value: "pte_retell_lecture",
    label: "PTE Retell Lecture",
    exams: ["pte_academic"],
    defaultPrep: 10,
    defaultSpeak: 40,
  },
];

export interface SpeakingPrompt {
  id: string;
  exam: ExamKey;
  task_type: SpeakingTaskType;
  title: string;
  prompt_text: string;
  cue_points: string | null;
  model_answer: string | null;
  topic: string | null;
  prep_seconds: number;
  speak_seconds: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface SpeakingPromptInput {
  exam: ExamKey;
  task_type: SpeakingTaskType;
  title: string;
  prompt_text: string;
  cue_points?: string | null;
  model_answer?: string | null;
  topic?: string | null;
  prep_seconds: number;
  speak_seconds: number;
  is_published: boolean;
}

export interface SpeakingFeedback {
  overall_band: number;
  criteria: Record<string, CriterionScore>;
  strengths: string[];
  improvements: string[];
  model_tips?: string;
  disclaimer?: string;
}

export interface SpeakingAttempt {
  id: string;
  prompt_id: string | null;
  exam: ExamKey;
  task_type: SpeakingTaskType;
  prompt_text: string;
  transcript: string;
  duration_seconds: number | null;
  overall_band: number | null;
  feedback: SpeakingFeedback | null;
  created_at: string;
}

export interface SpeakingAttemptSummary {
  id: string;
  exam: ExamKey;
  task_type: SpeakingTaskType;
  prompt_text: string;
  overall_band: number | null;
  created_at: string;
}

export interface SubmitSpeakingAttempt {
  prompt_id?: string | null;
  exam?: ExamKey;
  task_type?: SpeakingTaskType;
  prompt_text?: string;
  transcript: string;
  duration_seconds?: number | null;
}

export type ReadingQuestionType =
  | "true_false_not_given"
  | "yes_no_not_given"
  | "multiple_choice"
  | "matching_headings"
  | "short_answer"
  | "fill_blank";

export const READING_QTYPE_OPTIONS: {
  value: ReadingQuestionType;
  label: string;
}[] = [
  { value: "true_false_not_given", label: "True / False / Not Given" },
  { value: "yes_no_not_given", label: "Yes / No / Not Given" },
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "matching_headings", label: "Matching headings" },
  { value: "short_answer", label: "Short answer" },
  { value: "fill_blank", label: "Fill in the blank" },
];

export interface ReadingQuestionInput {
  question_type: ReadingQuestionType;
  question_text: string;
  options?: string[] | null;
  correct_answer: string;
  explanation?: string | null;
  order_index: number;
}

export interface ReadingQuestionPublic {
  id: string;
  order_index: number;
  question_type: ReadingQuestionType;
  question_text: string;
  options: string[] | null;
}

export interface ReadingQuestionAdmin extends ReadingQuestionPublic {
  correct_answer: string;
  explanation: string | null;
}

export interface ReadingPassageSummary {
  id: string;
  exam: ExamKey;
  title: string;
  topic: string | null;
  difficulty: "easy" | "medium" | "hard";
  time_limit_minutes: number;
  is_published: boolean;
  question_count: number;
  created_at: string;
}

export interface ReadingPassageStudent {
  id: string;
  exam: ExamKey;
  title: string;
  passage_text: string;
  topic: string | null;
  difficulty: "easy" | "medium" | "hard";
  time_limit_minutes: number;
  strategy_tip: string | null;
  questions: ReadingQuestionPublic[];
  created_at: string;
}

export interface ReadingPassageAdmin {
  id: string;
  exam: ExamKey;
  title: string;
  passage_text: string;
  topic: string | null;
  difficulty: "easy" | "medium" | "hard";
  time_limit_minutes: number;
  strategy_tip: string | null;
  is_published: boolean;
  questions: ReadingQuestionAdmin[];
  created_at: string;
  updated_at: string;
}

export interface ReadingPassageCreate {
  exam: ExamKey;
  title: string;
  passage_text: string;
  topic?: string | null;
  difficulty: "easy" | "medium" | "hard";
  time_limit_minutes: number;
  strategy_tip?: string | null;
  is_published: boolean;
  questions: ReadingQuestionInput[];
}

export interface ReadingResultItem {
  question_id: string;
  question_type: string;
  question_text: string;
  your_answer: string;
  correct_answer: string;
  is_correct: boolean;
  explanation: string | null;
}

export interface ReadingAttempt {
  id: string;
  passage_id: string | null;
  exam: ExamKey;
  passage_title: string;
  score: number;
  total: number;
  percentage: number;
  time_spent_seconds: number | null;
  results: ReadingResultItem[];
  created_at: string;
}

export interface ReadingAttemptSummary {
  id: string;
  passage_title: string;
  exam: ExamKey;
  score: number;
  total: number;
  percentage: number;
  created_at: string;
}

// ---- Listening (Phase 4) ----

export interface VocabItem {
  word: string;
  definition: string;
}

export type ListeningQuestionType = ReadingQuestionType;

export interface ListeningQuestionInput {
  order_index: number;
  question_type: ListeningQuestionType;
  question_text: string;
  options: string[] | null;
  correct_answer: string;
  explanation?: string | null;
}

export interface ListeningQuestionPublic {
  id: string;
  order_index: number;
  question_type: string;
  question_text: string;
  options: string[] | null;
}

export interface ListeningExerciseSummary {
  id: string;
  exam: ExamKey;
  title: string;
  topic: string | null;
  difficulty: "easy" | "medium" | "hard";
  time_limit_minutes: number;
  replay_limit: number;
  is_published: boolean;
  question_count: number;
  created_at: string;
}

export interface ListeningExerciseStudent {
  id: string;
  exam: ExamKey;
  title: string;
  topic: string | null;
  difficulty: "easy" | "medium" | "hard";
  time_limit_minutes: number;
  replay_limit: number;
  strategy_tip: string | null;
  questions: ListeningQuestionPublic[];
  created_at: string;
}

export interface ListeningExerciseCreate {
  exam: ExamKey;
  title: string;
  transcript: string;
  topic?: string | null;
  difficulty: "easy" | "medium" | "hard";
  time_limit_minutes: number;
  replay_limit: number;
  strategy_tip?: string | null;
  vocabulary?: VocabItem[] | null;
  is_published: boolean;
  questions: ListeningQuestionInput[];
}

export interface ListeningResultItem {
  question_id: string;
  question_type: string;
  question_text: string;
  your_answer: string;
  correct_answer: string;
  is_correct: boolean;
  explanation: string | null;
}

export interface ListeningAttempt {
  id: string;
  exercise_id: string | null;
  exam: ExamKey;
  exercise_title: string;
  score: number;
  total: number;
  percentage: number;
  replays_used: number;
  time_spent_seconds: number | null;
  results: ListeningResultItem[];
  transcript: string;
  vocabulary: VocabItem[] | null;
  created_at: string;
}

export interface ListeningAttemptSummary {
  id: string;
  exercise_title: string;
  exam: ExamKey;
  score: number;
  total: number;
  percentage: number;
  created_at: string;
}

// ---- Vocabulary SRS (Phase 5) ----

export const VOCAB_TOPIC_OPTIONS: { value: string; label: string }[] = [
  { value: "education", label: "Education" },
  { value: "environment", label: "Environment" },
  { value: "technology", label: "Technology" },
  { value: "health", label: "Health" },
  { value: "work", label: "Work" },
  { value: "travel", label: "Travel" },
  { value: "culture", label: "Culture" },
  { value: "science", label: "Science" },
  { value: "general", label: "General" },
];

export interface VocabCardInput {
  exam: ExamKey;
  topic: string;
  word: string;
  definition: string;
  example_sentence?: string | null;
  collocations?: string[] | null;
  is_published: boolean;
}

export interface VocabCardAdmin {
  id: string;
  exam: ExamKey;
  topic: string;
  word: string;
  definition: string;
  example_sentence: string | null;
  collocations: string[] | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface VocabCardSummary {
  id: string;
  exam: ExamKey;
  topic: string;
  word: string;
  definition: string;
  example_sentence: string | null;
  is_published: boolean;
  in_my_deck: boolean;
  status: string | null;
  next_review_at: string | null;
}

export interface VocabReviewCard {
  progress_id: string;
  card_id: string;
  word: string;
  definition: string;
  example_sentence: string | null;
  collocations: string[] | null;
  topic: string;
  status: string;
  repetitions: number;
  due: boolean;
}

export type VocabRating = "again" | "hard" | "good" | "easy";

export interface VocabReviewResponse {
  progress_id: string;
  card_id: string;
  status: string;
  interval_days: number;
  next_review_at: string;
  repetitions: number;
}

export interface VocabStats {
  learning: number;
  due: number;
  mastered: number;
  reviews_today: number;
  streak_days: number;
}

// ---- Progress & study plan (Phase 5) ----

export interface DailyGoal {
  skill: string;
  label: string;
  target: number;
  completed: number;
}

export interface WeakArea {
  area: string;
  question_type: string;
  miss_rate: number;
  missed: number;
  total: number;
  recommendation: string;
}

export interface WeeklyPlanDay {
  day: string;
  tasks: string[];
}

export interface SkillsBreakdown {
  writing: { attempts: number; avg_band: number | null; today: number };
  speaking: { attempts: number; avg_band: number | null; today: number };
  reading: { attempts: number; avg_percentage: number | null; today: number };
  listening: { attempts: number; avg_percentage: number | null; today: number };
  vocab: { learning: number; due: number; mastered: number; today: number };
}

export interface ProgressDashboard {
  streak_days: number;
  estimated_band: number | null;
  skills: SkillsBreakdown;
  weak_areas: WeakArea[];
  recommendations: string[];
  daily_goals: DailyGoal[];
  goals_completed_today: number;
  goals_total_today: number;
  days_to_exam: number | null;
  target_exam: ExamKey | null;
  target_score: string | null;
  exam_date: string | null;
  weekly_plan: WeeklyPlanDay[];
  focus_skills: string[];
  disclaimer: string;
}

// ---- Mock exams & exam leaderboard (Phase 6) ----

export interface MockExamSummary {
  id: string;
  exam: ExamKey;
  title: string;
  description: string | null;
  mode: "full" | "section";
  total_time_minutes: number;
  has_reading: boolean;
  has_listening: boolean;
  has_writing: boolean;
  has_speaking: boolean;
  is_published: boolean;
  created_at: string;
}

export interface MockExamCreate {
  exam: ExamKey;
  title: string;
  description?: string | null;
  mode: "full" | "section";
  total_time_minutes: number;
  reading_passage_id?: string | null;
  listening_exercise_id?: string | null;
  writing_prompt_id?: string | null;
  speaking_prompt_id?: string | null;
  is_published: boolean;
}

export interface MockExamQuestion {
  id: string;
  order_index: number;
  question_type: string;
  question_text: string;
  options: string[] | null;
}

export interface MockExamStudent {
  id: string;
  exam: ExamKey;
  title: string;
  description: string | null;
  mode: "full" | "section";
  total_time_minutes: number;
  reading: {
    id: string;
    title: string;
    passage_text: string;
    topic: string | null;
    strategy_tip: string | null;
    questions: MockExamQuestion[];
  } | null;
  listening: {
    id: string;
    title: string;
    topic: string | null;
    strategy_tip: string | null;
    replay_limit: number;
    questions: MockExamQuestion[];
  } | null;
  writing: {
    id: string;
    title: string;
    task_type: string;
    prompt_text: string;
    topic: string | null;
    min_words: number | null;
  } | null;
  speaking: {
    id: string;
    title: string;
    task_type: string;
    prompt_text: string;
    cue_points: string | null;
    prep_seconds: number;
    speak_seconds: number;
  } | null;
  created_at: string;
}

export interface MockAttemptSummary {
  id: string;
  mock_title: string;
  exam: ExamKey;
  overall_band: number | null;
  overall_percentage: number | null;
  points: number;
  reading_percentage: number | null;
  listening_percentage: number | null;
  writing_band: number | null;
  speaking_band: number | null;
  created_at: string;
}

export interface MockAttempt {
  id: string;
  mock_exam_id: string | null;
  exam: ExamKey;
  mock_title: string;
  reading_score: number | null;
  reading_total: number | null;
  reading_percentage: number | null;
  listening_score: number | null;
  listening_total: number | null;
  listening_percentage: number | null;
  writing_band: number | null;
  speaking_band: number | null;
  section_results: Record<string, unknown> | null;
  weak_topics: { area: string; question_type: string; miss_rate: number }[] | null;
  overall_band: number | null;
  overall_percentage: number | null;
  points: number;
  time_spent_seconds: number | null;
  previous_attempt: MockAttemptSummary | null;
  created_at: string;
}

export interface ExamLeaderboardEntry {
  rank: number;
  name: string;
  exam: ExamKey;
  best_overall_band: number | null;
  best_percentage: number | null;
  total_points: number;
  mock_attempts: number;
  writing_avg_band: number | null;
  avg_mock_band: number | null;
}
