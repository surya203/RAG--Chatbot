import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ClipboardList,
  Loader2,
  Trophy,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api";
import {
  fetchListeningAudioBlobUrl,
  getExamLeaderboard,
  getExamProfile,
  getMockAttempt,
  getPublishedMock,
  listMockAttempts,
  listPublishedMocks,
  submitMockAttempt,
} from "@/services/exam";
import type { MockAttempt, MockExamQuestion } from "@/types/exam";

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type SectionKey = "reading" | "listening" | "writing" | "speaking";

function QuestionInputs({
  questions,
  answers,
  setAnswers,
}: {
  questions: MockExamQuestion[];
  answers: Record<string, string>;
  setAnswers: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
}) {
  return (
    <ol className="space-y-5">
      {questions.map((q, idx) => (
        <li key={q.id}>
          <p className="mb-2 text-sm font-medium">
            {idx + 1}. {q.question_text}
            <span className="ml-2 text-xs font-normal text-[var(--color-muted-foreground)]">
              ({q.question_type.replace(/_/g, " ")})
            </span>
          </p>
          {q.options && q.options.length > 0 ? (
            <div className="space-y-1.5">
              {q.options.map((opt) => (
                <label
                  key={opt}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                    answers[q.id] === opt
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                      : "border-[var(--color-border)] hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === opt}
                    onChange={() =>
                      setAnswers((prev) => ({ ...prev, [q.id]: opt }))
                    }
                  />
                  {opt}
                </label>
              ))}
            </div>
          ) : (
            <Input
              placeholder="Your answer"
              value={answers[q.id] ?? ""}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
              }
            />
          )}
        </li>
      ))}
    </ol>
  );
}

export default function MockExamPage() {
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("mock");

  const { data: profile } = useQuery({
    queryKey: ["exam-profile"],
    queryFn: getExamProfile,
  });
  const examFilter = profile?.target_exam;

  const { data: summaries, isLoading: listLoading } = useQuery({
    queryKey: ["mocks", examFilter ?? "all"],
    queryFn: () => listPublishedMocks(examFilter),
  });

  const { data: history } = useQuery({
    queryKey: ["mock-attempts"],
    queryFn: listMockAttempts,
  });

  const { data: leaderboard } = useQuery({
    queryKey: ["exam-leaderboard", examFilter ?? "all"],
    queryFn: () => getExamLeaderboard(examFilter),
  });

  const { data: mock, isLoading: mockLoading } = useQuery({
    queryKey: ["mock", selectedId],
    queryFn: () => getPublishedMock(selectedId as string),
    enabled: !!selectedId,
  });

  const [section, setSection] = useState<SectionKey>("reading");
  const [readingAnswers, setReadingAnswers] = useState<Record<string, string>>({});
  const [listeningAnswers, setListeningAnswers] = useState<Record<string, string>>({});
  const [writingEssay, setWritingEssay] = useState("");
  const [speakingTranscript, setSpeakingTranscript] = useState("");
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [result, setResult] = useState<MockAttempt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const availableSections = useMemo(() => {
    if (!mock) return [] as SectionKey[];
    const keys: SectionKey[] = [];
    if (mock.reading) keys.push("reading");
    if (mock.listening) keys.push("listening");
    if (mock.writing) keys.push("writing");
    if (mock.speaking) keys.push("speaking");
    return keys;
  }, [mock]);

  useEffect(() => {
    setReadingAnswers({});
    setListeningAnswers({});
    setWritingEssay("");
    setSpeakingTranscript("");
    setResult(null);
    setError(null);
    setElapsed(0);
    setTimerRunning(false);
    if (mock) {
      setSecondsLeft(mock.total_time_minutes * 60);
      setSection(
        mock.reading
          ? "reading"
          : mock.listening
            ? "listening"
            : mock.writing
              ? "writing"
              : "speaking"
      );
    } else {
      setSecondsLeft(null);
    }
  }, [mock?.id]);

  useEffect(() => {
    if (!mock?.listening) {
      setAudioUrl(null);
      return;
    }
    let revoked = false;
    let url: string | null = null;
    fetchListeningAudioBlobUrl(mock.listening.id)
      .then((blobUrl) => {
        if (revoked) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        url = blobUrl;
        setAudioUrl(blobUrl);
      })
      .catch(() => setAudioUrl(null));
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [mock?.listening?.id]);

  useEffect(() => {
    if (!timerRunning || secondsLeft === null) return;
    if (secondsLeft <= 0) {
      setTimerRunning(false);
      return;
    }
    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s === null ? s : Math.max(0, s - 1)));
      setElapsed((e) => e + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning, secondsLeft]);

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!mock) throw new Error("No mock");
      return submitMockAttempt({
        mock_exam_id: mock.id,
        reading_answers: mock.reading ? readingAnswers : undefined,
        listening_answers: mock.listening ? listeningAnswers : undefined,
        writing_essay: mock.writing ? writingEssay : undefined,
        speaking_transcript: mock.speaking ? speakingTranscript : undefined,
        time_spent_seconds: elapsed || undefined,
      });
    },
    onSuccess: (attempt) => {
      setResult(attempt);
      setTimerRunning(false);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["mock-attempts"] });
      queryClient.invalidateQueries({ queryKey: ["exam-leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["progress-dashboard"] });
    },
    onError: (err) =>
      setError(getApiErrorMessage(err, "Could not submit mock attempt.")),
  });

  const viewHistoryMutation = useMutation({
    mutationFn: (id: string) => getMockAttempt(id),
    onSuccess: (attempt) => {
      setResult(attempt);
      setSearchParams({});
      setError(null);
    },
  });

  const selectMock = (id: string) => {
    setSearchParams({ mock: id });
    setResult(null);
  };

  const wordCount = writingEssay.trim()
    ? writingEssay.trim().split(/\s+/).length
    : 0;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/progress">Progress</Link>
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="space-y-4">
            <Card className="h-fit">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Mock exams</CardTitle>
                <CardDescription>
                  {examFilter
                    ? `Filtered by your exam: ${examFilter}`
                    : "All published mocks"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {listLoading ? (
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                ) : !summaries?.length ? (
                  <p className="text-sm text-[var(--color-muted-foreground)]">
                    No published mock exams yet.
                  </p>
                ) : (
                  summaries.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => selectMock(m.id)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                        selectedId === m.id
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                          : "border-[var(--color-border)] hover:bg-slate-50"
                      }`}
                    >
                      <span className="block font-medium">{m.title}</span>
                      <span className="text-xs text-[var(--color-muted-foreground)]">
                        {m.total_time_minutes} min ·{" "}
                        {[
                          m.has_reading && "R",
                          m.has_listening && "L",
                          m.has_writing && "W",
                          m.has_speaking && "S",
                        ]
                          .filter(Boolean)
                          .join("+")}
                      </span>
                    </button>
                  ))
                )}

                {history && history.length > 0 && (
                  <div className="border-t border-[var(--color-border)] pt-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                      Recent attempts
                    </p>
                    <ul className="space-y-1">
                      {history.slice(0, 6).map((h) => (
                        <li key={h.id}>
                          <button
                            className="w-full rounded px-2 py-1 text-left text-xs hover:bg-slate-100"
                            onClick={() => viewHistoryMutation.mutate(h.id)}
                          >
                            Band {h.overall_band ?? "—"} · {h.points} pts ·{" "}
                            {new Date(h.created_at).toLocaleDateString()}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  Exam leaderboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!leaderboard?.length ? (
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    Complete a mock to appear on the board.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {leaderboard.slice(0, 8).map((e) => (
                      <li
                        key={`${e.rank}-${e.name}-${e.exam}`}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span className="w-4 font-semibold">{e.rank}</span>
                        <span className="min-w-0 flex-1 truncate">{e.name}</span>
                        <span className="text-[var(--color-muted-foreground)]">
                          {e.best_overall_band ?? "—"}
                        </span>
                        <span className="font-medium text-[var(--color-primary)]">
                          {e.total_points}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {!selectedId && !result && (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                  <ClipboardList className="h-8 w-8 text-[var(--color-primary)]" />
                  <p className="text-sm text-[var(--color-muted-foreground)]">
                    Select a mock exam to start timed multi-skill practice.
                  </p>
                </CardContent>
              </Card>
            )}

            {selectedId && mockLoading && (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}

            {mock && !result && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{mock.title}</CardTitle>
                  <CardDescription>
                    {mock.exam} · {mock.mode} · {mock.total_time_minutes} min
                    {mock.description ? ` — ${mock.description}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4" />
                      {secondsLeft !== null ? formatTime(secondsLeft) : "—"}
                      {secondsLeft === 0 && (
                        <span className="text-[var(--color-destructive)]">
                          Time&apos;s up — you can still submit
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {!timerRunning ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTimerRunning(true)}
                          disabled={secondsLeft === 0}
                        >
                          Start timer
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTimerRunning(false)}
                        >
                          Pause
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {availableSections.map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={section === s ? "default" : "outline"}
                        onClick={() => setSection(s)}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </Button>
                    ))}
                  </div>

                  {section === "reading" && mock.reading && (
                    <div className="space-y-4">
                      <h3 className="font-medium">{mock.reading.title}</h3>
                      <div className="max-h-[220px] overflow-y-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-relaxed">
                        {mock.reading.passage_text}
                      </div>
                      <QuestionInputs
                        questions={mock.reading.questions}
                        answers={readingAnswers}
                        setAnswers={setReadingAnswers}
                      />
                    </div>
                  )}

                  {section === "listening" && mock.listening && (
                    <div className="space-y-4">
                      <h3 className="font-medium">{mock.listening.title}</h3>
                      {audioUrl ? (
                        <audio ref={audioRef} src={audioUrl} controls className="w-full" />
                      ) : (
                        <p className="text-sm text-[var(--color-muted-foreground)]">
                          Loading audio…
                        </p>
                      )}
                      <QuestionInputs
                        questions={mock.listening.questions}
                        answers={listeningAnswers}
                        setAnswers={setListeningAnswers}
                      />
                    </div>
                  )}

                  {section === "writing" && mock.writing && (
                    <div className="space-y-3">
                      <h3 className="font-medium">{mock.writing.title}</h3>
                      <p className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm">
                        {mock.writing.prompt_text}
                      </p>
                      <textarea
                        className="min-h-[180px] w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
                        value={writingEssay}
                        onChange={(e) => setWritingEssay(e.target.value)}
                        placeholder="Write your essay here…"
                      />
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        {wordCount} words
                        {mock.writing.min_words
                          ? ` (min ${mock.writing.min_words})`
                          : ""}
                      </p>
                    </div>
                  )}

                  {section === "speaking" && mock.speaking && (
                    <div className="space-y-3">
                      <h3 className="font-medium">{mock.speaking.title}</h3>
                      <p className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm">
                        {mock.speaking.prompt_text}
                      </p>
                      {mock.speaking.cue_points && (
                        <p className="text-sm text-[var(--color-muted-foreground)]">
                          Cues: {mock.speaking.cue_points}
                        </p>
                      )}
                      <textarea
                        className="min-h-[120px] w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
                        value={speakingTranscript}
                        onChange={(e) => setSpeakingTranscript(e.target.value)}
                        placeholder="Paste or type your speaking transcript (STT from Speaking Coach, or type notes)…"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      Submit scores all sections at once. Writing/Speaking use AI band
                      estimates.
                    </span>
                    <Button
                      onClick={() => submitMutation.mutate()}
                      disabled={submitMutation.isPending}
                    >
                      {submitMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Scoring…
                        </>
                      ) : (
                        "Submit mock"
                      )}
                    </Button>
                  </div>
                  {error && (
                    <p className="text-sm text-[var(--color-destructive)]">{error}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {result && (
              <ResultsCard
                result={result}
                onAgain={() => {
                  setResult(null);
                  if (selectedId) setSearchParams({ mock: selectedId });
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultsCard({
  result,
  onAgain,
}: {
  result: MockAttempt;
  onAgain: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mock results</CardTitle>
        <CardDescription>
          {result.mock_title} · {result.points} points
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-4 text-center">
          <p className="text-3xl font-bold">
            {result.overall_band != null ? result.overall_band : "—"}
          </p>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Estimated overall band
            {result.overall_percentage != null
              ? ` · ${result.overall_percentage}% blended`
              : ""}
            {result.time_spent_seconds != null
              ? ` · ${formatTime(result.time_spent_seconds)} spent`
              : ""}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {result.reading_percentage != null && (
            <div className="rounded-md border border-[var(--color-border)] p-3 text-sm">
              Reading: {result.reading_score}/{result.reading_total} (
              {result.reading_percentage}%)
            </div>
          )}
          {result.listening_percentage != null && (
            <div className="rounded-md border border-[var(--color-border)] p-3 text-sm">
              Listening: {result.listening_score}/{result.listening_total} (
              {result.listening_percentage}%)
            </div>
          )}
          {result.writing_band != null && (
            <div className="rounded-md border border-[var(--color-border)] p-3 text-sm">
              Writing band: {result.writing_band}
            </div>
          )}
          {result.speaking_band != null && (
            <div className="rounded-md border border-[var(--color-border)] p-3 text-sm">
              Speaking band: {result.speaking_band}
            </div>
          )}
        </div>

        {result.previous_attempt && (
          <div className="rounded-md border border-dashed border-[var(--color-border)] bg-amber-50/60 p-3 text-sm">
            <p className="mb-1 font-medium">Compared to previous attempt</p>
            <p className="text-[var(--color-muted-foreground)]">
              Previous band {result.previous_attempt.overall_band ?? "—"} ·{" "}
              {result.previous_attempt.points} pts
              {result.overall_band != null &&
              result.previous_attempt.overall_band != null
                ? result.overall_band > result.previous_attempt.overall_band
                  ? " — improved!"
                  : result.overall_band < result.previous_attempt.overall_band
                    ? " — slightly lower"
                    : " — same band"
                : ""}
            </p>
          </div>
        )}

        {result.weak_topics && result.weak_topics.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">Weak topics</p>
            <ul className="space-y-1">
              {result.weak_topics.map((w) => (
                <li
                  key={w.question_type}
                  className="flex items-center gap-2 text-sm"
                >
                  <CheckCircle2 className="h-4 w-4 text-amber-500" />
                  {w.area} ({w.miss_rate}% miss rate)
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-[var(--color-muted-foreground)]">
          AI band estimates are guidance for practice only and are not official exam
          scores.
        </p>

        <Button variant="outline" onClick={onAgain}>
          Practice again
        </Button>
      </CardContent>
    </Card>
  );
}
