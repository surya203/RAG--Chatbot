import { api } from "@/lib/api";
import type {
  ExamProfile,
  ExamProfileUpsert,
  ListeningAttempt,
  ListeningAttemptSummary,
  ListeningExerciseCreate,
  ListeningExerciseStudent,
  ListeningExerciseSummary,
  MockAttempt,
  MockAttemptSummary,
  MockExamCreate,
  MockExamStudent,
  MockExamSummary,
  ExamLeaderboardEntry,
  ProgressDashboard,
  ReadingAttempt,
  ReadingAttemptSummary,
  ReadingPassageAdmin,
  ReadingPassageCreate,
  ReadingPassageStudent,
  ReadingPassageSummary,
  SpeakingAttempt,
  SpeakingAttemptSummary,
  SpeakingPrompt,
  SpeakingPromptInput,
  SubmitSpeakingAttempt,
  SubmitWritingAttempt,
  VocabCardAdmin,
  VocabCardInput,
  VocabCardSummary,
  VocabRating,
  VocabReviewCard,
  VocabReviewResponse,
  VocabStats,
  WritingAttempt,
  WritingAttemptSummary,
  WritingPrompt,
  WritingPromptInput,
} from "@/types/exam";

export async function getExamProfile(): Promise<ExamProfile | null> {
  const { data } = await api.get<ExamProfile | null>("/api/v1/exam-profile/me");
  return data;
}

export async function saveExamProfile(
  payload: ExamProfileUpsert
): Promise<ExamProfile> {
  const { data } = await api.put<ExamProfile>("/api/v1/exam-profile/me", payload);
  return data;
}

export async function listPublishedPrompts(exam?: string): Promise<WritingPrompt[]> {
  const { data } = await api.get<WritingPrompt[]>("/api/v1/writing/prompts", {
    params: exam ? { exam } : undefined,
  });
  return data;
}

export async function getPublishedPrompt(id: string): Promise<WritingPrompt> {
  const { data } = await api.get<WritingPrompt>(`/api/v1/writing/prompts/${id}`);
  return data;
}

export async function submitWritingAttempt(
  payload: SubmitWritingAttempt
): Promise<WritingAttempt> {
  const { data } = await api.post<WritingAttempt>("/api/v1/writing/attempts", payload);
  return data;
}

export async function listWritingAttempts(): Promise<WritingAttemptSummary[]> {
  const { data } = await api.get<WritingAttemptSummary[]>("/api/v1/writing/attempts");
  return data;
}

export async function getWritingAttempt(id: string): Promise<WritingAttempt> {
  const { data } = await api.get<WritingAttempt>(`/api/v1/writing/attempts/${id}`);
  return data;
}

// Admin
export async function adminListPrompts(exam?: string): Promise<WritingPrompt[]> {
  const { data } = await api.get<WritingPrompt[]>("/api/v1/admin/writing-prompts", {
    params: exam ? { exam } : undefined,
  });
  return data;
}

export async function adminCreatePrompt(
  payload: WritingPromptInput
): Promise<WritingPrompt> {
  const { data } = await api.post<WritingPrompt>(
    "/api/v1/admin/writing-prompts",
    payload
  );
  return data;
}

export async function adminUpdatePrompt(
  id: string,
  payload: Partial<WritingPromptInput>
): Promise<WritingPrompt> {
  const { data } = await api.patch<WritingPrompt>(
    `/api/v1/admin/writing-prompts/${id}`,
    payload
  );
  return data;
}

export async function adminDeletePrompt(id: string): Promise<void> {
  await api.delete(`/api/v1/admin/writing-prompts/${id}`);
}

// ---- Speaking (student) ----

export async function listPublishedSpeakingPrompts(
  exam?: string
): Promise<SpeakingPrompt[]> {
  const { data } = await api.get<SpeakingPrompt[]>("/api/v1/speaking/prompts", {
    params: exam ? { exam } : undefined,
  });
  return data;
}

export async function submitSpeakingAttempt(
  payload: SubmitSpeakingAttempt
): Promise<SpeakingAttempt> {
  const { data } = await api.post<SpeakingAttempt>(
    "/api/v1/speaking/attempts",
    payload
  );
  return data;
}

export async function listSpeakingAttempts(): Promise<SpeakingAttemptSummary[]> {
  const { data } = await api.get<SpeakingAttemptSummary[]>(
    "/api/v1/speaking/attempts"
  );
  return data;
}

export async function getSpeakingAttempt(id: string): Promise<SpeakingAttempt> {
  const { data } = await api.get<SpeakingAttempt>(
    `/api/v1/speaking/attempts/${id}`
  );
  return data;
}

// ---- Speaking (admin) ----

export async function adminListSpeakingPrompts(
  exam?: string
): Promise<SpeakingPrompt[]> {
  const { data } = await api.get<SpeakingPrompt[]>(
    "/api/v1/admin/speaking-prompts",
    { params: exam ? { exam } : undefined }
  );
  return data;
}

export async function adminCreateSpeakingPrompt(
  payload: SpeakingPromptInput
): Promise<SpeakingPrompt> {
  const { data } = await api.post<SpeakingPrompt>(
    "/api/v1/admin/speaking-prompts",
    payload
  );
  return data;
}

export async function adminUpdateSpeakingPrompt(
  id: string,
  payload: Partial<SpeakingPromptInput>
): Promise<SpeakingPrompt> {
  const { data } = await api.patch<SpeakingPrompt>(
    `/api/v1/admin/speaking-prompts/${id}`,
    payload
  );
  return data;
}

export async function adminDeleteSpeakingPrompt(id: string): Promise<void> {
  await api.delete(`/api/v1/admin/speaking-prompts/${id}`);
}

// ---- Reading (student) ----

export async function listPublishedReadingPassages(
  exam?: string
): Promise<ReadingPassageSummary[]> {
  const { data } = await api.get<ReadingPassageSummary[]>(
    "/api/v1/reading/passages",
    { params: exam ? { exam } : undefined }
  );
  return data;
}

export async function getPublishedReadingPassage(
  id: string
): Promise<ReadingPassageStudent> {
  const { data } = await api.get<ReadingPassageStudent>(
    `/api/v1/reading/passages/${id}`
  );
  return data;
}

export async function submitReadingAttempt(payload: {
  passage_id: string;
  answers: Record<string, string>;
  time_spent_seconds?: number | null;
}): Promise<ReadingAttempt> {
  const { data } = await api.post<ReadingAttempt>(
    "/api/v1/reading/attempts",
    payload
  );
  return data;
}

export async function listReadingAttempts(): Promise<ReadingAttemptSummary[]> {
  const { data } = await api.get<ReadingAttemptSummary[]>(
    "/api/v1/reading/attempts"
  );
  return data;
}

export async function getReadingAttempt(id: string): Promise<ReadingAttempt> {
  const { data } = await api.get<ReadingAttempt>(
    `/api/v1/reading/attempts/${id}`
  );
  return data;
}

// ---- Reading (admin) ----

export async function adminListReadingPassages(
  exam?: string
): Promise<ReadingPassageSummary[]> {
  const { data } = await api.get<ReadingPassageSummary[]>(
    "/api/v1/admin/reading-passages",
    { params: exam ? { exam } : undefined }
  );
  return data;
}

export async function adminGetReadingPassage(
  id: string
): Promise<ReadingPassageAdmin> {
  const { data } = await api.get<ReadingPassageAdmin>(
    `/api/v1/admin/reading-passages/${id}`
  );
  return data;
}

export async function adminCreateReadingPassage(
  payload: ReadingPassageCreate
): Promise<ReadingPassageAdmin> {
  const { data } = await api.post<ReadingPassageAdmin>(
    "/api/v1/admin/reading-passages",
    payload
  );
  return data;
}

export async function adminUpdateReadingPassage(
  id: string,
  payload: Partial<ReadingPassageCreate> & { is_published?: boolean }
): Promise<ReadingPassageAdmin> {
  const { data } = await api.patch<ReadingPassageAdmin>(
    `/api/v1/admin/reading-passages/${id}`,
    payload
  );
  return data;
}

export async function adminDeleteReadingPassage(id: string): Promise<void> {
  await api.delete(`/api/v1/admin/reading-passages/${id}`);
}

// ---- Listening (student) ----

export async function listPublishedListeningExercises(
  exam?: string
): Promise<ListeningExerciseSummary[]> {
  const { data } = await api.get<ListeningExerciseSummary[]>(
    "/api/v1/listening/exercises",
    { params: exam ? { exam } : undefined }
  );
  return data;
}

export async function getPublishedListeningExercise(
  id: string
): Promise<ListeningExerciseStudent> {
  const { data } = await api.get<ListeningExerciseStudent>(
    `/api/v1/listening/exercises/${id}`
  );
  return data;
}

export async function fetchListeningAudioBlobUrl(
  exerciseId: string
): Promise<string> {
  const { data } = await api.get<Blob>(
    `/api/v1/listening/exercises/${exerciseId}/audio`,
    { responseType: "blob" }
  );
  return URL.createObjectURL(data);
}

export async function submitListeningAttempt(payload: {
  exercise_id: string;
  answers: Record<string, string>;
  replays_used?: number;
  time_spent_seconds?: number;
}): Promise<ListeningAttempt> {
  const { data } = await api.post<ListeningAttempt>(
    "/api/v1/listening/attempts",
    payload
  );
  return data;
}

export async function listListeningAttempts(): Promise<ListeningAttemptSummary[]> {
  const { data } = await api.get<ListeningAttemptSummary[]>(
    "/api/v1/listening/attempts"
  );
  return data;
}

export async function getListeningAttempt(id: string): Promise<ListeningAttempt> {
  const { data } = await api.get<ListeningAttempt>(
    `/api/v1/listening/attempts/${id}`
  );
  return data;
}

// ---- Listening (admin) ----

export async function adminListListeningExercises(
  exam?: string
): Promise<ListeningExerciseSummary[]> {
  const { data } = await api.get<ListeningExerciseSummary[]>(
    "/api/v1/admin/listening-exercises",
    { params: exam ? { exam } : undefined }
  );
  return data;
}

export async function adminCreateListeningExercise(
  audio: File,
  payload: ListeningExerciseCreate
): Promise<void> {
  const form = new FormData();
  form.append("audio", audio);
  form.append("exam", payload.exam);
  form.append("title", payload.title);
  form.append("transcript", payload.transcript);
  form.append("difficulty", payload.difficulty);
  form.append("time_limit_minutes", String(payload.time_limit_minutes));
  form.append("replay_limit", String(payload.replay_limit));
  form.append("is_published", String(payload.is_published));
  form.append("questions_json", JSON.stringify(payload.questions));
  if (payload.topic) form.append("topic", payload.topic);
  if (payload.strategy_tip) form.append("strategy_tip", payload.strategy_tip);
  if (payload.vocabulary?.length) {
    form.append("vocabulary_json", JSON.stringify(payload.vocabulary));
  }
  await api.post("/api/v1/admin/listening-exercises", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export async function adminUpdateListeningExercise(
  id: string,
  payload: { is_published?: boolean; title?: string; replay_limit?: number }
): Promise<void> {
  await api.patch(`/api/v1/admin/listening-exercises/${id}`, payload);
}

export async function adminDeleteListeningExercise(id: string): Promise<void> {
  await api.delete(`/api/v1/admin/listening-exercises/${id}`);
}

// ---- Vocabulary (student) ----

export async function listVocabCards(
  exam?: string,
  topic?: string
): Promise<VocabCardSummary[]> {
  const { data } = await api.get<VocabCardSummary[]>("/api/v1/vocab/cards", {
    params: { exam, topic },
  });
  return data;
}

export async function listDueVocabCards(): Promise<VocabReviewCard[]> {
  const { data } = await api.get<VocabReviewCard[]>("/api/v1/vocab/due");
  return data;
}

export async function getVocabStats(): Promise<VocabStats> {
  const { data } = await api.get<VocabStats>("/api/v1/vocab/stats");
  return data;
}

export async function enrollVocabTopic(topic: string): Promise<{ enrolled: number; skipped: number }> {
  const { data } = await api.post<{ enrolled: number; skipped: number }>(
    "/api/v1/vocab/enroll",
    { topic }
  );
  return data;
}

export async function enrollVocabCard(cardId: string): Promise<void> {
  await api.post(`/api/v1/vocab/cards/${cardId}/enroll`);
}

export async function reviewVocabCard(
  progressId: string,
  rating: VocabRating
): Promise<VocabReviewResponse> {
  const { data } = await api.post<VocabReviewResponse>("/api/v1/vocab/review", {
    progress_id: progressId,
    rating,
  });
  return data;
}

// ---- Vocabulary (admin) ----

export async function adminListVocabCards(
  exam?: string,
  topic?: string
): Promise<VocabCardAdmin[]> {
  const { data } = await api.get<VocabCardAdmin[]>("/api/v1/admin/vocab-cards", {
    params: { exam, topic },
  });
  return data;
}

export async function adminCreateVocabCard(
  payload: VocabCardInput
): Promise<VocabCardAdmin> {
  const { data } = await api.post<VocabCardAdmin>(
    "/api/v1/admin/vocab-cards",
    payload
  );
  return data;
}

export async function adminUpdateVocabCard(
  id: string,
  payload: { is_published?: boolean; definition?: string; example_sentence?: string }
): Promise<VocabCardAdmin> {
  const { data } = await api.patch<VocabCardAdmin>(
    `/api/v1/admin/vocab-cards/${id}`,
    payload
  );
  return data;
}

export async function adminDeleteVocabCard(id: string): Promise<void> {
  await api.delete(`/api/v1/admin/vocab-cards/${id}`);
}

// ---- Progress (student) ----

export async function getProgressDashboard(): Promise<ProgressDashboard> {
  const { data } = await api.get<ProgressDashboard>(
    "/api/v1/progress/dashboard"
  );
  return data;
}

// ---- Mock exams (student) ----

export async function listPublishedMocks(
  exam?: string
): Promise<MockExamSummary[]> {
  const { data } = await api.get<MockExamSummary[]>("/api/v1/mocks", {
    params: exam ? { exam } : undefined,
  });
  return data;
}

export async function getPublishedMock(id: string): Promise<MockExamStudent> {
  const { data } = await api.get<MockExamStudent>(`/api/v1/mocks/${id}`);
  return data;
}

export async function submitMockAttempt(payload: {
  mock_exam_id: string;
  reading_answers?: Record<string, string>;
  listening_answers?: Record<string, string>;
  writing_essay?: string;
  speaking_transcript?: string;
  time_spent_seconds?: number;
}): Promise<MockAttempt> {
  const { data } = await api.post<MockAttempt>("/api/v1/mocks/attempts", payload, {
    timeout: 120000,
  });
  return data;
}

export async function listMockAttempts(): Promise<MockAttemptSummary[]> {
  const { data } = await api.get<MockAttemptSummary[]>("/api/v1/mocks/attempts");
  return data;
}

export async function getMockAttempt(id: string): Promise<MockAttempt> {
  const { data } = await api.get<MockAttempt>(`/api/v1/mocks/attempts/${id}`);
  return data;
}

export async function getExamLeaderboard(
  exam?: string
): Promise<ExamLeaderboardEntry[]> {
  const { data } = await api.get<ExamLeaderboardEntry[]>(
    "/api/v1/exam-leaderboard",
    { params: exam ? { exam } : undefined }
  );
  return data;
}

// ---- Mock exams (admin) ----

export async function adminListMockExams(
  exam?: string
): Promise<MockExamSummary[]> {
  const { data } = await api.get<MockExamSummary[]>(
    "/api/v1/admin/mock-exams",
    { params: exam ? { exam } : undefined }
  );
  return data;
}

export async function adminCreateMockExam(
  payload: MockExamCreate
): Promise<void> {
  await api.post("/api/v1/admin/mock-exams", payload);
}

export async function adminUpdateMockExam(
  id: string,
  payload: Partial<MockExamCreate>
): Promise<void> {
  await api.patch(`/api/v1/admin/mock-exams/${id}`, payload);
}

export async function adminDeleteMockExam(id: string): Promise<void> {
  await api.delete(`/api/v1/admin/mock-exams/${id}`);
}
