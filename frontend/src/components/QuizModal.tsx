import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, GraduationCap, Loader2, RotateCcw, X, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api";
import { generateQuiz, submitQuizAttempt } from "@/services/quizzes";
import type {
  Difficulty,
  Quiz,
  QuizAttemptResult,
  QuestionType,
} from "@/types/quiz";
import type { Document } from "@/types/document";

interface QuizModalProps {
  document: Document;
  onClose: () => void;
}

const TYPES: { value: QuestionType; label: string }[] = [
  { value: "mcq", label: "MCQs" },
  { value: "true_false", label: "True / False" },
  { value: "fill_blank", label: "Fill in the blanks" },
  { value: "mixed", label: "Mixed" },
];
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const COUNTS = [5, 10, 15];

type Step = "config" | "taking" | "results";

export default function QuizModal({ document, onClose }: QuizModalProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("config");
  const [type, setType] = useState<QuestionType>("mcq");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [count, setCount] = useState(10);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const genMutation = useMutation({
    mutationFn: () =>
      generateQuiz(document.id, {
        question_type: type,
        difficulty,
        num_questions: count,
      }),
    onMutate: () => setError(null),
    onSuccess: (q) => {
      setQuiz(q);
      setAnswers({});
      setResult(null);
      setStep("taking");
    },
    onError: (err) => setError(getApiErrorMessage(err, "Could not generate the quiz.")),
  });

  const submitMutation = useMutation({
    mutationFn: () => submitQuizAttempt(quiz!.id, answers),
    onMutate: () => setError(null),
    onSuccess: (r) => {
      setResult(r);
      setStep("results");
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
    onError: (err) => setError(getApiErrorMessage(err, "Could not submit the quiz.")),
  });

  const setAnswer = (qid: string, value: string) =>
    setAnswers((prev) => ({ ...prev, [qid]: value }));

  const answeredCount = quiz
    ? quiz.questions.filter((q) => (answers[q.id] ?? "").trim()).length
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="flex items-center gap-2 truncate text-sm font-medium">
            <GraduationCap className="h-4 w-4 text-[var(--color-primary)]" />
            Quiz · {document.original_name}.pdf
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <p className="mb-3 text-sm text-[var(--color-destructive)]">{error}</p>
          )}

          {step === "config" && (
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-sm font-medium">Question type</p>
                <div className="flex flex-wrap gap-2">
                  {TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setType(t.value)}
                      className={`rounded-md border px-3 py-1.5 text-sm ${
                        type === t.value
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                          : "border-[var(--color-border)] hover:bg-slate-50"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Difficulty</p>
                <div className="flex gap-2">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={`rounded-md border px-3 py-1.5 text-sm capitalize ${
                        difficulty === d
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                          : "border-[var(--color-border)] hover:bg-slate-50"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Number of questions</p>
                <div className="flex gap-2">
                  {COUNTS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCount(c)}
                      className={`rounded-md border px-3 py-1.5 text-sm ${
                        count === c
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                          : "border-[var(--color-border)] hover:bg-slate-50"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => genMutation.mutate()}
                disabled={genMutation.isPending}
              >
                {genMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating quiz…
                  </>
                ) : (
                  <>
                    <GraduationCap className="h-4 w-4" />
                    Generate quiz
                  </>
                )}
              </Button>
            </div>
          )}

          {step === "taking" && quiz && (
            <ol className="space-y-5">
              {quiz.questions.map((q, idx) => (
                <li key={q.id}>
                  <p className="mb-2 text-sm font-medium">
                    {idx + 1}. {q.question}
                  </p>
                  {q.type === "fill_blank" ? (
                    <Input
                      placeholder="Your answer"
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                    />
                  ) : (
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
                            onChange={() => setAnswer(q.id, opt)}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}

          {step === "results" && result && (
            <div className="space-y-5">
              <div className="rounded-lg bg-slate-50 p-4 text-center">
                <p className="text-3xl font-bold">
                  {result.score}/{result.total}
                </p>
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  {result.percentage}% · {result.points} points earned
                </p>
              </div>
              <ol className="space-y-4">
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
                      {idx + 1}. {r.question}
                    </p>
                    <p className="text-xs">
                      Your answer:{" "}
                      <span
                        className={
                          r.is_correct ? "text-green-600" : "text-[var(--color-destructive)]"
                        }
                      >
                        {r.your_answer || "(blank)"}
                      </span>
                    </p>
                    {!r.is_correct && (
                      <p className="text-xs">
                        Correct answer:{" "}
                        <span className="text-green-600">{r.correct_answer}</span>
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
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "taking" && quiz && (
          <div className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-3">
            <span className="text-xs text-[var(--color-muted-foreground)]">
              {answeredCount}/{quiz.questions.length} answered
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
                "Submit quiz"
              )}
            </Button>
          </div>
        )}
        {step === "results" && (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-4 py-3">
            <Button
              variant="outline"
              onClick={() => {
                setAnswers({});
                setResult(null);
                setStep("taking");
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Retake
            </Button>
            <Button onClick={() => setStep("config")}>New quiz</Button>
          </div>
        )}
      </div>
    </div>
  );
}
