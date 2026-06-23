import { api } from "@/lib/api";
import type {
  LeaderboardEntry,
  Quiz,
  QuizAttemptResult,
  QuizGenerateRequest,
} from "@/types/quiz";

export async function generateQuiz(
  documentId: string,
  request: QuizGenerateRequest
): Promise<Quiz> {
  const { data } = await api.post<Quiz>(
    `/api/v1/documents/${documentId}/quizzes`,
    request
  );
  return data;
}

export async function submitQuizAttempt(
  quizId: string,
  answers: Record<string, string>
): Promise<QuizAttemptResult> {
  const { data } = await api.post<QuizAttemptResult>(
    `/api/v1/quizzes/${quizId}/attempt`,
    { answers }
  );
  return data;
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data } = await api.get<LeaderboardEntry[]>("/api/v1/leaderboard");
  return data;
}
