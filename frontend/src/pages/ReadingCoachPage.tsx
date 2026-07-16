import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Loader2,
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
  getExamProfile,
  getPublishedReadingPassage,
  getReadingAttempt,
  listPublishedReadingPassages,
  listReadingAttempts,
  submitReadingAttempt,
} from "@/services/exam";
import type { ReadingAttempt, ReadingPassageStudent } from "@/types/exam";

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ReadingCoachPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("passage");

  const { data: profile } = useQuery({
    queryKey: ["exam-profile"],
    queryFn: getExamProfile,
  });
  const examFilter = profile?.target_exam;

  const { data: summaries, isLoading: listLoading } = useQuery({
    queryKey: ["reading-passages", examFilter ?? "all"],
    queryFn: () => listPublishedReadingPassages(examFilter),
  });

  const { data: history } = useQuery({
    queryKey: ["reading-attempts"],
    queryFn: listReadingAttempts,
  });

  const { data: passage, isLoading: passageLoading } = useQuery({
    queryKey: ["reading-passage", selectedId],
    queryFn: () => getPublishedReadingPassage(selectedId as string),
    enabled: !!selectedId,
  });

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [result, setResult] = useState<ReadingAttempt | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAnswers({});
    setResult(null);
    setError(null);
    setElapsed(0);
    setTimerRunning(false);
    if (passage) {
      setSecondsLeft(passage.time_limit_minutes * 60);
    } else {
      setSecondsLeft(null);
    }
  }, [passage?.id]);

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

  const answeredCount = useMemo(() => {
    if (!passage) return 0;
    return passage.questions.filter((q) => (answers[q.id] ?? "").trim()).length;
  }, [passage, answers]);

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!passage) throw new Error("No passage");
      return submitReadingAttempt({
        passage_id: passage.id,
        answers,
        time_spent_seconds: elapsed || undefined,
      });
    },
    onSuccess: (attempt) => {
      setResult(attempt);
      setTimerRunning(false);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["reading-attempts"] });
    },
    onError: (err) =>
      setError(getApiErrorMessage(err, "Could not submit reading attempt.")),
  });

  const viewHistoryMutation = useMutation({
    mutationFn: (id: string) => getReadingAttempt(id),
    onSuccess: (attempt) => {
      setResult(attempt);
      setSearchParams({});
      setError(null);
    },
  });

  const selectPassage = (id: string) => {
    setSearchParams({ passage: id });
    setResult(null);
  };

  const renderQuestionInput = (passageData: ReadingPassageStudent, qid: string) => {
    const q = passageData.questions.find((item) => item.id === qid);
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
      title="Reading Practice"
      description="Timed passages with exam-style questions and instant scoring."
    >
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Reading passages</CardTitle>
              <CardDescription>
                {examFilter
                  ? `Filtered by your exam: ${examFilter}`
                  : "All published passages"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {listLoading ? (
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              ) : !summaries?.length ? (
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  No published reading passages yet.
                </p>
              ) : (
                summaries.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectPassage(p.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                      selectedId === p.id
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                        : "border-[var(--color-border)] hover:bg-slate-50"
                    }`}
                  >
                    <span className="block font-medium">{p.title}</span>
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      {p.difficulty} · {p.time_limit_minutes} min ·{" "}
                      {p.question_count} Qs
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
                  <BookOpen className="h-8 w-8 text-[var(--color-primary)]" />
                  <p className="text-sm text-[var(--color-muted-foreground)]">
                    Select a passage to start timed reading practice.
                  </p>
                </CardContent>
              </Card>
            )}

            {selectedId && passageLoading && (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}

            {passage && !result && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{passage.title}</CardTitle>
                  <CardDescription>
                    {passage.exam} · {passage.difficulty}
                    {passage.topic ? ` · ${passage.topic}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {passage.strategy_tip && (
                    <div className="rounded-md border border-dashed border-[var(--color-border)] bg-amber-50/60 p-3 text-sm">
                      <p className="mb-1 text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">
                        Strategy tip
                      </p>
                      {passage.strategy_tip}
                    </div>
                  )}

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

                  <div className="max-h-[280px] overflow-y-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-relaxed">
                    {passage.passage_text}
                  </div>

                  <ol className="space-y-5">
                    {passage.questions.map((q, idx) => (
                      <li key={q.id}>
                        <p className="mb-2 text-sm font-medium">
                          {idx + 1}. {q.question_text}
                          <span className="ml-2 text-xs font-normal text-[var(--color-muted-foreground)]">
                            ({q.question_type.replace(/_/g, " ")})
                          </span>
                        </p>
                        {renderQuestionInput(passage, q.id)}
                      </li>
                    ))}
                  </ol>

                  <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      {answeredCount}/{passage.questions.length} answered
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
                    {result.passage_title} · {result.score}/{result.total} (
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
                  <Button
                    variant="outline"
                    onClick={() => {
                      setResult(null);
                      if (selectedId) setSearchParams({ passage: selectedId });
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
