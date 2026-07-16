import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, Loader2, PenLine } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getApiErrorMessage } from "@/lib/api";
import {
  getExamProfile,
  getWritingAttempt,
  listPublishedPrompts,
  listWritingAttempts,
  submitWritingAttempt,
} from "@/services/exam";
import type { WritingAttempt, WritingPrompt } from "@/types/exam";

function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function WritingCoachPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("prompt");

  const { data: profile } = useQuery({
    queryKey: ["exam-profile"],
    queryFn: getExamProfile,
  });

  const examFilter = profile?.target_exam;

  const { data: prompts, isLoading: promptsLoading } = useQuery({
    queryKey: ["writing-prompts", examFilter ?? "all"],
    queryFn: () => listPublishedPrompts(examFilter),
  });

  const { data: history } = useQuery({
    queryKey: ["writing-attempts"],
    queryFn: listWritingAttempts,
  });

  const selected = useMemo(
    () => prompts?.find((p) => p.id === selectedId) ?? null,
    [prompts, selectedId]
  );

  const [essay, setEssay] = useState("");
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [result, setResult] = useState<WritingAttempt | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEssay("");
    setResult(null);
    setError(null);
    setElapsed(0);
    setTimerRunning(false);
    setSecondsLeft(selected ? selected.time_limit_minutes * 60 : null);
  }, [selected?.id]);

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
      if (!selected) throw new Error("No prompt selected");
      return submitWritingAttempt({
        prompt_id: selected.id,
        essay_text: essay,
        time_spent_seconds: elapsed || undefined,
      });
    },
    onSuccess: (attempt) => {
      setResult(attempt);
      setTimerRunning(false);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["writing-attempts"] });
    },
    onError: (err) =>
      setError(getApiErrorMessage(err, "Could not score your essay.")),
  });

  const viewHistoryMutation = useMutation({
    mutationFn: (id: string) => getWritingAttempt(id),
    onSuccess: (attempt) => {
      setResult(attempt);
      setSearchParams({});
      setError(null);
    },
  });

  const selectPrompt = (p: WritingPrompt) => {
    setSearchParams({ prompt: p.id });
    setResult(null);
  };

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
            <Link to="/exam-profile">Exam profile</Link>
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Prompts</CardTitle>
              <CardDescription>
                {examFilter
                  ? `Filtered by your exam: ${examFilter}`
                  : "All published prompts"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {promptsLoading ? (
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              ) : !prompts?.length ? (
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  No published prompts yet. Ask your admin to add some.
                </p>
              ) : (
                prompts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectPrompt(p)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                      selected?.id === p.id
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                        : "border-[var(--color-border)] hover:bg-slate-50"
                    }`}
                  >
                    <span className="block font-medium">{p.title}</span>
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      {p.task_type} · {p.time_limit_minutes} min
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
                          Band {h.overall_band ?? "—"} ·{" "}
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
            {!selected && !result ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                  <PenLine className="h-8 w-8 text-[var(--color-primary)]" />
                  <p className="text-sm text-[var(--color-muted-foreground)]">
                    Select a writing prompt to start timed practice.
                  </p>
                </CardContent>
              </Card>
            ) : null}

            {selected && !result && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{selected.title}</CardTitle>
                  <CardDescription>
                    {selected.exam} · {selected.task_type}
                    {selected.min_words ? ` · ${selected.min_words}+ words` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm">
                    {selected.prompt_text}
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

                  <textarea
                    className="min-h-[240px] w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
                    placeholder="Write your essay here…"
                    value={essay}
                    onChange={(e) => setEssay(e.target.value)}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      {wordCount(essay)} words
                      {selected.min_words
                        ? ` (aim for ${selected.min_words}+)`
                        : ""}
                    </span>
                    <Button
                      onClick={() => submitMutation.mutate()}
                      disabled={
                        submitMutation.isPending || wordCount(essay) < 30
                      }
                    >
                      {submitMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Scoring…
                        </>
                      ) : (
                        "Submit for AI feedback"
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
                  <CardTitle>Feedback</CardTitle>
                  <CardDescription>
                    Estimated overall:{" "}
                    <span className="font-semibold text-[var(--color-foreground)]">
                      {result.overall_band ?? "—"}
                    </span>
                    {" · "}
                    {result.word_count} words
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {result.feedback?.criteria && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {Object.entries(result.feedback.criteria).map(
                        ([key, val]) => (
                          <div
                            key={key}
                            className="rounded-md border border-[var(--color-border)] p-3"
                          >
                            <p className="text-sm font-medium capitalize">
                              {key.replace(/_/g, " ")}: {val.score}
                            </p>
                            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                              {val.feedback}
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {result.feedback?.strengths?.length ? (
                    <div>
                      <p className="mb-1 text-sm font-semibold">Strengths</p>
                      <ul className="list-disc space-y-1 pl-5 text-sm">
                        {result.feedback.strengths.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {result.feedback?.improvements?.length ? (
                    <div>
                      <p className="mb-1 text-sm font-semibold">
                        Top improvements
                      </p>
                      <ol className="list-decimal space-y-1 pl-5 text-sm">
                        {result.feedback.improvements.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ol>
                    </div>
                  ) : null}

                  {result.feedback?.improved_paragraph ? (
                    <div>
                      <p className="mb-1 text-sm font-semibold">
                        Improved sample paragraph
                      </p>
                      <p className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm">
                        {result.feedback.improved_paragraph}
                      </p>
                    </div>
                  ) : null}

                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {result.feedback?.disclaimer ??
                      "AI band estimates are guidance for practice only and are not official exam scores."}
                  </p>

                  <Button
                    variant="outline"
                    onClick={() => {
                      setResult(null);
                      if (selected) {
                        setEssay("");
                        setElapsed(0);
                        setSecondsLeft(selected.time_limit_minutes * 60);
                      }
                    }}
                  >
                    Practice again
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
