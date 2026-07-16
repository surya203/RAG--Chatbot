import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  Headphones,
  Loader2,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";

import StudentPageShell from "@/components/StudentPageShell";
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
  getExamProfile,
  getListeningAttempt,
  getPublishedListeningExercise,
  listListeningAttempts,
  listPublishedListeningExercises,
  submitListeningAttempt,
} from "@/services/exam";
import type { ListeningAttempt, ListeningExerciseStudent } from "@/types/exam";

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ListeningCoachPage() {
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("exercise");

  const { data: profile } = useQuery({
    queryKey: ["exam-profile"],
    queryFn: getExamProfile,
  });
  const examFilter = profile?.target_exam;

  const { data: summaries, isLoading: listLoading } = useQuery({
    queryKey: ["listening-exercises", examFilter ?? "all"],
    queryFn: () => listPublishedListeningExercises(examFilter),
  });

  const { data: history } = useQuery({
    queryKey: ["listening-attempts"],
    queryFn: listListeningAttempts,
  });

  const { data: exercise, isLoading: exerciseLoading } = useQuery({
    queryKey: ["listening-exercise", selectedId],
    queryFn: () => getPublishedListeningExercise(selectedId as string),
    enabled: !!selectedId,
  });

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [replaysUsed, setReplaysUsed] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [result, setResult] = useState<ListeningAttempt | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId) {
      setAudioUrl(null);
      return;
    }
    let revoked = false;
    let url: string | null = null;
    setAudioLoading(true);
    setError(null);
    fetchListeningAudioBlobUrl(selectedId)
      .then((blobUrl) => {
        if (revoked) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        url = blobUrl;
        setAudioUrl(blobUrl);
      })
      .catch((err) =>
        setError(getApiErrorMessage(err, "Could not load audio."))
      )
      .finally(() => setAudioLoading(false));
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [selectedId]);

  useEffect(() => {
    setAnswers({});
    setResult(null);
    setError(null);
    setElapsed(0);
    setReplaysUsed(0);
    setTimerRunning(false);
    if (exercise) {
      setSecondsLeft(exercise.time_limit_minutes * 60);
    } else {
      setSecondsLeft(null);
    }
  }, [exercise?.id]);

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

  const replayLimit = exercise?.replay_limit ?? 0;
  const replaysRemaining =
    replayLimit === 0 ? null : Math.max(0, replayLimit - replaysUsed);
  const canReplay = replayLimit === 0 || replaysUsed < replayLimit;

  const handleAudioEnded = () => {
    setReplaysUsed((n) => n + 1);
  };

  const handleReplay = () => {
    if (!canReplay || !audioRef.current) return;
    audioRef.current.currentTime = 0;
    void audioRef.current.play();
  };

  const answeredCount = useMemo(() => {
    if (!exercise) return 0;
    return exercise.questions.filter((q) => (answers[q.id] ?? "").trim()).length;
  }, [exercise, answers]);

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!exercise) throw new Error("No exercise");
      return submitListeningAttempt({
        exercise_id: exercise.id,
        answers,
        replays_used: replaysUsed,
        time_spent_seconds: elapsed || undefined,
      });
    },
    onSuccess: (attempt) => {
      setResult(attempt);
      setTimerRunning(false);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["listening-attempts"] });
    },
    onError: (err) =>
      setError(getApiErrorMessage(err, "Could not submit listening attempt.")),
  });

  const viewHistoryMutation = useMutation({
    mutationFn: (id: string) => getListeningAttempt(id),
    onSuccess: (attempt) => {
      setResult(attempt);
      setSearchParams({});
      setError(null);
    },
  });

  const selectExercise = (id: string) => {
    setSearchParams({ exercise: id });
    setResult(null);
  };

  const renderQuestionInput = (
    exerciseData: ListeningExerciseStudent,
    qid: string
  ) => {
    const q = exerciseData.questions.find((item) => item.id === qid);
    if (!q) return null;
    if (q.options && q.options.length > 0) {
      return (
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
      );
    }
    return (
      <Input
        placeholder="Your answer"
        value={answers[q.id] ?? ""}
        onChange={(e) =>
          setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
        }
      />
    );
  };

  return (
    <StudentPageShell
      title="Listening Practice"
      description="Audio exercises with replay limits, timers, and scored questions."
    >
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Listening exercises</CardTitle>
              <CardDescription>
                {examFilter
                  ? `Filtered by your exam: ${examFilter}`
                  : "All published exercises"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {listLoading ? (
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              ) : !summaries?.length ? (
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  No published listening exercises yet.
                </p>
              ) : (
                summaries.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => selectExercise(e.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                      selectedId === e.id
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                        : "border-[var(--color-border)] hover:bg-slate-50"
                    }`}
                  >
                    <span className="block font-medium">{e.title}</span>
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      {e.difficulty} · {e.time_limit_minutes} min ·{" "}
                      {e.replay_limit === 0
                        ? "unlimited replays"
                        : `${e.replay_limit} replays`}{" "}
                      · {e.question_count} Qs
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
                    {history.slice(0, 8).map((h) => (
                      <li key={h.id}>
                        <button
                          className="w-full rounded px-2 py-1 text-left text-xs hover:bg-slate-100"
                          onClick={() => viewHistoryMutation.mutate(h.id)}
                        >
                          {h.score}/{h.total} ({h.percentage}%) ·{" "}
                          {new Date(h.created_at).toLocaleDateString()}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            {!selectedId && !result && (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                  <Headphones className="h-8 w-8 text-[var(--color-primary)]" />
                  <p className="text-sm text-[var(--color-muted-foreground)]">
                    Select an exercise to start timed listening practice.
                  </p>
                </CardContent>
              </Card>
            )}

            {selectedId && exerciseLoading && (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}

            {exercise && !result && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{exercise.title}</CardTitle>
                  <CardDescription>
                    {exercise.exam} · {exercise.difficulty}
                    {exercise.topic ? ` · ${exercise.topic}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {exercise.strategy_tip && (
                    <div className="rounded-md border border-dashed border-[var(--color-border)] bg-amber-50/60 p-3 text-sm">
                      <p className="mb-1 text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">
                        Strategy tip
                      </p>
                      {exercise.strategy_tip}
                    </div>
                  )}

                  <div className="rounded-md border border-[var(--color-border)] bg-slate-50 p-4">
                    {audioLoading ? (
                      <div className="flex items-center justify-center gap-2 py-4">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-sm">Loading audio…</span>
                      </div>
                    ) : audioUrl ? (
                      <div className="space-y-3">
                        <audio
                          ref={audioRef}
                          src={audioUrl}
                          controls
                          className="w-full"
                          onEnded={handleAudioEnded}
                          onPlay={() => {
                            if (!timerRunning && secondsLeft !== null && secondsLeft > 0) {
                              setTimerRunning(true);
                            }
                          }}
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="text-[var(--color-muted-foreground)]">
                            {replayLimit === 0
                              ? "Unlimited replays"
                              : replaysRemaining !== null
                                ? `${replaysRemaining} replay${replaysRemaining === 1 ? "" : "s"} left`
                                : ""}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleReplay}
                            disabled={!canReplay}
                          >
                            <RotateCcw className="h-4 w-4" />
                            Replay
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--color-destructive)]">
                        Audio unavailable.
                      </p>
                    )}
                  </div>

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

                  <ol className="space-y-5">
                    {exercise.questions.map((q, idx) => (
                      <li key={q.id}>
                        <p className="mb-2 text-sm font-medium">
                          {idx + 1}. {q.question_text}
                          <span className="ml-2 text-xs font-normal text-[var(--color-muted-foreground)]">
                            ({q.question_type.replace(/_/g, " ")})
                          </span>
                        </p>
                        {renderQuestionInput(exercise, q.id)}
                      </li>
                    ))}
                  </ol>

                  <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      {answeredCount}/{exercise.questions.length} answered
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
                        "Submit answers"
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
              <Card>
                <CardHeader>
                  <CardTitle>Results</CardTitle>
                  <CardDescription>
                    {result.exercise_title} · {result.score}/{result.total} (
                    {result.percentage}%)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg bg-slate-50 p-4 text-center">
                    <p className="text-3xl font-bold">
                      {result.score}/{result.total}
                    </p>
                    <p className="text-sm text-[var(--color-muted-foreground)]">
                      {result.percentage}% correct
                      {result.time_spent_seconds != null
                        ? ` · ${formatTime(result.time_spent_seconds)} spent`
                        : ""}
                      {result.replays_used > 0
                        ? ` · ${result.replays_used} listen${result.replays_used === 1 ? "" : "s"}`
                        : ""}
                    </p>
                  </div>

                  <ol className="space-y-3">
                    {result.results.map((r, idx) => (
                      <li
                        key={r.question_id}
                        className="rounded-md border border-[var(--color-border)] p-3"
                      >
                        <p className="mb-1 flex items-start gap-2 text-sm font-medium">
                          {r.is_correct ? (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                          ) : (
                            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-destructive)]" />
                          )}
                          {idx + 1}. {r.question_text}
                        </p>
                        <p className="text-xs">
                          Your answer:{" "}
                          <span
                            className={
                              r.is_correct
                                ? "text-green-600"
                                : "text-[var(--color-destructive)]"
                            }
                          >
                            {r.your_answer || "(blank)"}
                          </span>
                        </p>
                        {!r.is_correct && (
                          <p className="text-xs">
                            Correct:{" "}
                            <span className="text-green-600">
                              {r.correct_answer}
                            </span>
                          </p>
                        )}
                        {r.explanation && (
                          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                            {r.explanation}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>

                  {result.transcript && (
                    <div className="rounded-md border border-[var(--color-border)] p-3">
                      <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">
                        Transcript
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {result.transcript}
                      </p>
                    </div>
                  )}

                  {result.vocabulary && result.vocabulary.length > 0 && (
                    <div className="rounded-md border border-[var(--color-border)] p-3">
                      <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">
                        Key vocabulary
                      </p>
                      <ul className="space-y-1 text-sm">
                        {result.vocabulary.map((v) => (
                          <li key={v.word}>
                            <span className="font-medium">{v.word}</span>
                            {": "}
                            {v.definition}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    onClick={() => {
                      setResult(null);
                      if (selectedId) setSearchParams({ exercise: selectedId });
                    }}
                  >
                    Practice again
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
    </StudentPageShell>
  );
}
