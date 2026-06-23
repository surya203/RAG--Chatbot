export type QuestionType = "mcq" | "true_false" | "fill_blank" | "mixed";
export type Difficulty = "easy" | "medium" | "hard";

export interface QuizQuestion {
  id: string;
  type: string;
  difficulty: string;
  question: string;
  options: string[];
}

export interface Quiz {
  id: string;
  document_id: string;
  title: string;
  question_type: string;
  difficulty: string;
  created_at: string;
  questions: QuizQuestion[];
}

export interface QuizResultItem {
  question_id: string;
  type: string;
  question: string;
  options: string[];
  your_answer: string;
  correct_answer: string;
  is_correct: boolean;
  explanation: string;
}

export interface QuizAttemptResult {
  score: number;
  total: number;
  percentage: number;
  points: number;
  results: QuizResultItem[];
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  points: number;
  attempts: number;
  avg_percentage: number;
}

export interface QuizGenerateRequest {
  question_type: QuestionType;
  difficulty: Difficulty;
  num_questions: number;
}
