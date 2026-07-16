import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api";
import {
  adminCreateReadingPassage,
  adminDeleteReadingPassage,
  adminListReadingPassages,
  adminUpdateReadingPassage,
} from "@/services/exam";
import {
  EXAM_OPTIONS,
  READING_QTYPE_OPTIONS,
  type ExamKey,
  type ReadingPassageCreate,
  type ReadingQuestionInput,
  type ReadingQuestionType,
} from "@/types/exam";

function emptyQuestion(index: number): ReadingQuestionInput {
  return {
    order_index: index,
    question_type: "true_false_not_given",
    question_text: "",
    options: ["True", "False", "Not Given"],
    correct_answer: "True",
    explanation: "",
  };
}

const emptyForm: ReadingPassageCreate = {
  exam: "ielts_academic",
  title: "",
  passage_text: "",
  topic: "",
  difficulty: "medium",
  time_limit_minutes: 20,
  strategy_tip: "",
  is_published: true,
  questions: [emptyQuestion(0)],
};

function defaultOptions(type: ReadingQuestionType): string[] | null {
  if (type === "true_false_not_given") return ["True", "False", "Not Given"];
  if (type === "yes_no_not_given") return ["Yes", "No", "Not Given"];
  if (type === "multiple_choice" || type === "matching_headings") {
    return ["A", "B", "C", "D"];
  }
  return null;
}

export default function AdminReadingPanel() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ReadingPassageCreate>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const { data: passages, isLoading } = useQuery({
    queryKey: ["admin-reading-passages"],
    queryFn: () => adminListReadingPassages(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      adminCreateReadingPassage({
        ...form,
        title: form.title.trim(),
        passage_text: form.passage_text.trim(),
        topic: form.topic?.trim() || null,
        strategy_tip: form.strategy_tip?.trim() || null,
        questions: form.questions.map((q, i) => ({
          ...q,
          order_index: i,
          question_text: q.question_text.trim(),
          correct_answer: q.correct_answer.trim(),
          explanation: q.explanation?.trim() || null,
          options: q.options?.filter((o) => o.trim()) ?? null,
        })),
      }),
    onSuccess: () => {
      setForm(emptyForm);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["admin-reading-passages"] });
    },
    onError: (err) =>
      setError(getApiErrorMessage(err, "Could not create reading passage.")),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_published }: { id: string; is_published: boolean }) =>
      adminUpdateReadingPassage(id, { is_published }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-reading-passages"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminDeleteReadingPassage(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-reading-passages"] }),
  });

  const updateQuestion = (index: number, patch: Partial<ReadingQuestionInput>) => {
    setForm((f) => ({
      ...f,
      questions: f.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add reading passage</CardTitle>
          <CardDescription>
            Publish a passage with exam-style questions for timed student practice.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-[var(--color-destructive)]">{error}</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Exam</Label>
              <select
                className="flex h-10 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 text-sm"
                value={form.exam}
                onChange={(e) =>
                  setForm((f) => ({ ...f, exam: e.target.value as ExamKey }))
                }
              >
                {EXAM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Difficulty</Label>
              <select
                className="flex h-10 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 text-sm"
                value={form.difficulty}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    difficulty: e.target.value as "easy" | "medium" | "hard",
                  }))
                }
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Topic</Label>
              <Input
                value={form.topic ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Time limit (min)</Label>
              <Input
                type="number"
                value={form.time_limit_minutes}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    time_limit_minutes: Number(e.target.value) || 20,
                  }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Passage text</Label>
            <textarea
              className="min-h-[180px] w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
              value={form.passage_text}
              onChange={(e) =>
                setForm((f) => ({ ...f, passage_text: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Strategy tip (optional)</Label>
            <textarea
              className="min-h-[70px] w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
              value={form.strategy_tip ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, strategy_tip: e.target.value }))
              }
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Questions</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    questions: [...f.questions, emptyQuestion(f.questions.length)],
                  }))
                }
              >
                <Plus className="h-4 w-4" />
                Add question
              </Button>
            </div>
            {form.questions.map((q, idx) => (
              <div
                key={idx}
                className="space-y-2 rounded-md border border-[var(--color-border)] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Q{idx + 1}</p>
                  {form.questions.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          questions: f.questions.filter((_, i) => i !== idx),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4 text-[var(--color-destructive)]" />
                    </Button>
                  )}
                </div>
                <select
                  className="flex h-10 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 text-sm"
                  value={q.question_type}
                  onChange={(e) => {
                    const question_type = e.target.value as ReadingQuestionType;
                    updateQuestion(idx, {
                      question_type,
                      options: defaultOptions(question_type),
                      correct_answer: defaultOptions(question_type)?.[0] ?? "",
                    });
                  }}
                >
                  {READING_QTYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="Question text"
                  value={q.question_text}
                  onChange={(e) =>
                    updateQuestion(idx, { question_text: e.target.value })
                  }
                />
                {q.options && (
                  <Input
                    placeholder="Options (comma-separated)"
                    value={q.options.join(", ")}
                    onChange={(e) =>
                      updateQuestion(idx, {
                        options: e.target.value.split(",").map((s) => s.trim()),
                      })
                    }
                  />
                )}
                <Input
                  placeholder="Correct answer"
                  value={q.correct_answer}
                  onChange={(e) =>
                    updateQuestion(idx, { correct_answer: e.target.value })
                  }
                />
                <Input
                  placeholder="Explanation (optional)"
                  value={q.explanation ?? ""}
                  onChange={(e) =>
                    updateQuestion(idx, { explanation: e.target.value })
                  }
                />
              </div>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(e) =>
                setForm((f) => ({ ...f, is_published: e.target.checked }))
              }
            />
            Publish immediately
          </label>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={
              createMutation.isPending ||
              !form.title.trim() ||
              form.passage_text.trim().length < 50 ||
              form.questions.some(
                (q) => !q.question_text.trim() || !q.correct_answer.trim()
              )
            }
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add reading passage
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reading library</CardTitle>
          <CardDescription>
            {passages?.length ?? 0} passage
            {(passages?.length ?? 0) === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !passages?.length ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">
              No reading passages yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {passages.map((p) => (
                <li
                  key={p.id}
                  className="rounded-md border border-[var(--color-border)] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{p.title}</p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        {p.exam} · {p.difficulty} · {p.time_limit_minutes} min ·{" "}
                        {p.question_count} questions ·{" "}
                        {p.is_published ? "Published" : "Draft"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={toggleMutation.isPending}
                        onClick={() =>
                          toggleMutation.mutate({
                            id: p.id,
                            is_published: !p.is_published,
                          })
                        }
                      >
                        {p.is_published ? "Unpublish" : "Publish"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (window.confirm(`Delete "${p.title}"?`)) {
                            deleteMutation.mutate(p.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-[var(--color-destructive)]" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
