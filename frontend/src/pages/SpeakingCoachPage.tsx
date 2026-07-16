import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mic, Square } from "lucide-react";
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
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { getApiErrorMessage } from "@/lib/api";
import {
  getExamProfile,
  getSpeakingAttempt,
  listPublishedSpeakingPrompts,
  listSpeakingAttempts,
  submitSpeakingAttempt,
} from "@/services/exam";
import type { SpeakingAttempt, SpeakingPrompt } from "@/types/exam";

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Phase = "idle" | "prep" | "speak" | "done";

export default function SpeakingCoachPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("prompt");

  const { data: profile } = useQuery({
    queryKey: ["exam-profile"],
    queryFn: getExamProfile,
  });
  const examFilter = profile?.target_exam;

  const { data: prompts, isLoading: promptsLoading } = useQuery({
    queryKey: ["speaking-prompts", examFilter ?? "all"],
    queryFn: () => listPublishedSpeakingPrompts(examFilter),
  });

  const { data: history } = useQuery({
    queryKey: ["speaking-attempts"],
    queryFn: listSpeakingAttempts,
  });

  const selected = useMemo(
    () => prompts?.find((p) => p.id === selectedId) ?? null,
    [prompts, selectedId]
  );

  const [phase, setPhase] = useState<Phase>("idle");
  const [prepLeft, setPrepLeft] = useState(0);
  const [speakLeft, setSpeakLeft] = useState(0);
  const [elapsedSpeak, setElapsedSpeak] = useState(0);
  const [finalParts, setFinalParts] = useState<string[]>([]);
  const [interim, setInterim] = useState("");
  const [result, setResult] = useState<SpeakingAttempt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showModel, setShowModel] = useState(false);
  const autoStartedRef = useRef(false);

  const transcript = useMemo(() => {
    const base = finalParts.join(" ").trim();
    return interim ? `${base}${base ? " " : ""}${interim}`.trim() : base;
  }, [finalParts, interim]);

  const onTranscript = useCallback((text: string, isFinal: boolean) => {
    const clean = text.trim();
    if (!clean) return;
    if (isFinal) {
      setFinalParts((prev) => [...prev, clean]);
      setInterim("");
    } else {
      setInterim(clean);
    }
  }, []);

  const stt = useSpeechRecognition({
    onTranscript,
    continuous: true,
  });

  useEffect(() => {
    stt.stop();
    setPhase("idle");
    setPrepLeft(0);
    setSpeakLeft(0);
    setElapsedSpeak(0);
    setFinalParts([]);
    setInterim("");
    setResult(null);
    setError(null);
    setShowModel(false);
    autoStartedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when prompt changes
  }, [selected?.id]);

  // Prep countdown
  useEffect(() => {
    if (phase !== "prep") return;
    if (prepLeft <= 0) {
      setPhase("speak");
      setSpeakLeft(selected?.speak_seconds ?? 120);
      setElapsedSpeak(0);
      autoStartedRef.current = false;
      return;
    }
    const id = window.setInterval(() => setPrepLeft((s) => s - 1), 1000);
    return () => window.clearInterval(id);
  }, [phase, prepLeft, selected?.speak_seconds]);

  // Speak countdown + auto mic
  useEffect(() => {
    if (phase !== "speak") return;
    if (!autoStartedRef.current && stt.supported) {
      autoStartedRef.current = true;
      stt.start();
    }
    if (speakLeft <= 0) {
      stt.stop();
      setPhase("done");
      return;
    }
    const id = window.setInterval(() => {
      setSpeakLeft((s) => s - 1);
      setElapsedSpeak((e) => e + 1);
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, speakLeft, stt.supported]);

  const startPractice = () => {
    if (!selected) return;
    setResult(null);
    setError(null);
    setFinalParts([]);
    setInterim("");
    setShowModel(false);
    if (selected.prep_seconds > 0) {
      setPhase("prep");
      setPrepLeft(selected.prep_seconds);
    } else {
      setPhase("speak");
      setSpeakLeft(selected.speak_seconds);
      setElapsedSpeak(0);
      autoStartedRef.current = false;
    }
  };

  const stopSpeaking = () => {
    stt.stop();
    setPhase("done");
  };

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("No prompt");
      return submitSpeakingAttempt({
        prompt_id: selected.id,
        transcript,
        duration_seconds: elapsedSpeak || undefined,
      });
    },
    onSuccess: (attempt) => {
      setResult(attempt);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["speaking-attempts"] });
    },
    onError: (err) =>
      setError(getApiErrorMessage(err, "Could not score your speaking.")),
  });

  const viewHistoryMutation = useMutation({
    mutationFn: (id: string) => getSpeakingAttempt(id),
    onSuccess: (attempt) => {
      setResult(attempt);
      setSearchParams({});
      setPhase("idle");
      setError(null);
    },
  });

  const selectPrompt = (p: SpeakingPrompt) => {
    setSearchParams({ prompt: p.id });
    setResult(null);
  };

  return (
    <StudentPageShell
      title="Speaking Coach"
      description="Record spoken answers and get AI feedback on fluency and coherence."
    >
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Speaking prompts</CardTitle>
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
                  No published speaking prompts yet.
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
                      {p.task_type}
                      {p.prep_seconds ? ` · prep ${p.prep_seconds}s` : ""} · speak{" "}
                      {p.speak_seconds}s
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
            {!selected && !result && (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                  <Mic className="h-8 w-8 text-[var(--color-primary)]" />
                  <p className="text-sm text-[var(--color-muted-foreground)]">
                    Select a speaking prompt to start timed practice.
                  </p>
                </CardContent>
              </Card>
            )}

            {selected && !result && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{selected.title}</CardTitle>
                  <CardDescription>
                    {selected.exam} · {selected.task_type}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm">
                    {selected.prompt_text}
                  </div>
                  {selected.cue_points && (
                    <div className="rounded-md border border-dashed border-[var(--color-border)] p-3 text-sm">
                      <p className="mb-1 text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">
                        Cue points
                      </p>
                      <pre className="whitespace-pre-wrap font-sans">
                        {selected.cue_points}
                      </pre>
                    </div>
                  )}

                  {phase === "idle" && (
                    <div className="space-y-2">
                      {!stt.supported && (
                        <p className="text-sm text-[var(--color-destructive)]">
                          Speech recognition needs Chrome or Edge on this device.
                        </p>
                      )}
                      <Button onClick={startPractice} disabled={!stt.supported}>
                        <Mic className="h-4 w-4" />
                        Start practice
                      </Button>
                    </div>
                  )}

                  {phase === "prep" && (
                    <div className="rounded-md bg-amber-50 p-4 text-center">
                      <p className="text-sm font-medium">Preparation time</p>
                      <p className="text-3xl font-bold tabular-nums">
                        {formatTime(prepLeft)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                        Think about your answer — speaking starts automatically.
                      </p>
                    </div>
                  )}

                  {phase === "speak" && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-red-50 p-3">
                        <span className="text-sm font-medium text-red-700">
                          {stt.listening ? "Recording…" : "Speak now"}
                        </span>
                        <span className="text-xl font-bold tabular-nums text-red-700">
                          {formatTime(speakLeft)}
                        </span>
                      </div>
                      <div className="min-h-[120px] rounded-md border border-[var(--color-border)] p-3 text-sm">
                        {transcript || (
                          <span className="text-[var(--color-muted-foreground)]">
                            Your live transcript will appear here…
                          </span>
                        )}
                      </div>
                      {stt.error && (
                        <p className="text-sm text-[var(--color-destructive)]">
                          {stt.error}
                        </p>
                      )}
                      <div className="flex gap-2">
                        {!stt.listening && (
                          <Button variant="outline" onClick={() => stt.start()}>
                            <Mic className="h-4 w-4" />
                            Resume mic
                          </Button>
                        )}
                        <Button variant="outline" onClick={stopSpeaking}>
                          <Square className="h-4 w-4" />
                          Finish speaking
                        </Button>
                      </div>
                    </div>
                  )}

                  {phase === "done" && (
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Your transcript</p>
                      <textarea
                        className="min-h-[140px] w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
                        value={transcript}
                        onChange={(e) => {
                          setFinalParts([e.target.value]);
                          setInterim("");
                        }}
                      />
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        You can edit the transcript before scoring (STT may mishear words).
                      </p>
                      <Button
                        onClick={() => submitMutation.mutate()}
                        disabled={
                          submitMutation.isPending || transcript.trim().length < 10
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
                      {error && (
                        <p className="text-sm text-[var(--color-destructive)]">
                          {error}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {result && (
              <Card>
                <CardHeader>
                  <CardTitle>Speaking feedback</CardTitle>
                  <CardDescription>
                    Estimated overall:{" "}
                    <span className="font-semibold text-[var(--color-foreground)]">
                      {result.overall_band ?? "—"}
                    </span>
                    {result.duration_seconds != null
                      ? ` · ${result.duration_seconds}s spoken`
                      : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-md bg-slate-50 p-3 text-sm">
                    <p className="mb-1 text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">
                      Transcript
                    </p>
                    {result.transcript}
                  </div>

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

                  {result.feedback?.model_tips ? (
                    <div>
                      <p className="mb-1 text-sm font-semibold">Strategy tips</p>
                      <p className="text-sm text-[var(--color-muted-foreground)]">
                        {result.feedback.model_tips}
                      </p>
                    </div>
                  ) : null}

                  {selected?.model_answer && (
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowModel((v) => !v)}
                      >
                        {showModel ? "Hide" : "Show"} model answer script
                      </Button>
                      {showModel && (
                        <p className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm">
                          {selected.model_answer}
                        </p>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {result.feedback?.disclaimer}
                  </p>

                  <Button
                    variant="outline"
                    onClick={() => {
                      setResult(null);
                      setPhase("idle");
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
