import { useRef, useState } from "react";
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
  adminCreateListeningExercise,
  adminDeleteListeningExercise,
  adminListListeningExercises,
  adminUpdateListeningExercise,
} from "@/services/exam";
import {
  EXAM_OPTIONS,
  READING_QTYPE_OPTIONS,
  type ExamKey,
  type ListeningExerciseCreate,
  type ListeningQuestionInput,
  type ListeningQuestionType,
} from "@/types/exam";

function emptyQuestion(index: number): ListeningQuestionInput {
  return {
    order_index: index,
    question_type: "true_false_not_given",
    question_text: "",
    options: ["True", "False", "Not Given"],
    correct_answer: "True",
    explanation: "",
  };
}

const emptyForm: ListeningExerciseCreate = {
  exam: "ielts_academic",
  title: "",
  transcript: "",
  topic: "",
  difficulty: "medium",
  time_limit_minutes: 10,
  replay_limit: 2,
  strategy_tip: "",
  vocabulary: [],
  is_published: true,
  questions: [emptyQuestion(0)],
};

function defaultOptions(type: ListeningQuestionType): string[] | null {
  if (type === "true_false_not_given") return ["True", "False", "Not Given"];
  if (type === "yes_no_not_given") return ["Yes", "No", "Not Given"];
  if (type === "multiple_choice" || type === "matching_headings") {
    return ["A", "B", "C", "D"];
  }
  return null;
}

export default function AdminListeningPanel() {
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ListeningExerciseCreate>(emptyForm);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [vocabText, setVocabText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: exercises, isLoading } = useQuery({
    queryKey: ["admin-listening-exercises"],
    queryFn: () => adminListListeningExercises(),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!audioFile) throw new Error("Audio file required");
      const vocabulary = vocabText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [word, ...rest] = line.split(":");
          return {
            word: word.trim(),
            definition: rest.join(":").trim() || word.trim(),
          };
        });
      return adminCreateListeningExercise(audioFile, {
        ...form,
        title: form.title.trim(),
        transcript: form.transcript.trim(),
        topic: form.topic?.trim() || null,
        strategy_tip: form.strategy_tip?.trim() || null,
        vocabulary: vocabulary.length ? vocabulary : null,
        questions: form.questions.map((q, i) => ({
          ...q,
          order_index: i,
          question_text: q.question_text.trim(),
          correct_answer: q.correct_answer.trim(),
          explanation: q.explanation?.trim() || null,
          options: q.options?.filter((o) => o.trim()) ?? null,
        })),
      });
    },
    onSuccess: () => {
      setForm(emptyForm);
      setAudioFile(null);
      setVocabText("");
      if (audioRef.current) audioRef.current.value = "";
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["admin-listening-exercises"] });
    },
    onError: (err) =>
      setError(getApiErrorMessage(err, "Could not create listening exercise.")),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_published }: { id: string; is_published: boolean }) =>
      adminUpdateListeningExercise(id, { is_published }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-listening-exercises"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminDeleteListeningExercise(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-listening-exercises"] }),
  });

  const updateQuestion = (index: number, patch: Partial<ListeningQuestionInput>) => {
    setForm((f) => ({
      ...f,
      questions: f.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add listening exercise</CardTitle>
          <CardDescription>
            Upload audio with exam-style questions. Transcript and vocabulary are
            revealed to students after they submit.
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
          <div className="grid gap-4 sm:grid-cols-3">
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
                    time_limit_minutes: Number(e.target.value) || 10,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Replay limit (0 = unlimited)</Label>
              <Input
                type="number"
                value={form.replay_limit}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    replay_limit: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Audio file (mp3, wav, m4a)</Label>
            <Input
              ref={audioRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm"
              onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-2">
            <Label>Transcript</Label>
            <textarea
              className="min-h-[120px] w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
              value={form.transcript}
              onChange={(e) =>
                setForm((f) => ({ ...f, transcript: e.target.value }))
              }
              placeholder="Full audio transcript (shown after submit)…"
            />
          </div>
          <div className="space-y-2">
            <Label>Vocabulary (optional, one per line: word: definition)</Label>
            <textarea
              className="min-h-[70px] w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
              value={vocabText}
              onChange={(e) => setVocabText(e.target.value)}
              placeholder="accommodation: a place to live&#10;itinerary: a planned route"
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
                    const question_type = e.target.value as ListeningQuestionType;
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
              !audioFile ||
              !form.title.trim() ||
              form.transcript.trim().length < 20 ||
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
            Add listening exercise
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Listening library</CardTitle>
          <CardDescription>
            {exercises?.length ?? 0} exercise
            {(exercises?.length ?? 0) === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !exercises?.length ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">
              No listening exercises yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {exercises.map((e) => (
                <li
                  key={e.id}
                  className="rounded-md border border-[var(--color-border)] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{e.title}</p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        {e.exam} · {e.difficulty} · {e.time_limit_minutes} min ·{" "}
                        {e.replay_limit === 0
                          ? "unlimited replays"
                          : `${e.replay_limit} replays`}{" "}
                        · {e.question_count} questions ·{" "}
                        {e.is_published ? "Published" : "Draft"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={toggleMutation.isPending}
                        onClick={() =>
                          toggleMutation.mutate({
                            id: e.id,
                            is_published: !e.is_published,
                          })
                        }
                      >
                        {e.is_published ? "Unpublish" : "Publish"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (window.confirm(`Delete "${e.title}"?`)) {
                            deleteMutation.mutate(e.id);
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
