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
  adminCreateMockExam,
  adminDeleteMockExam,
  adminListListeningExercises,
  adminListMockExams,
  adminListPrompts,
  adminListReadingPassages,
  adminListSpeakingPrompts,
  adminUpdateMockExam,
} from "@/services/exam";
import {
  EXAM_OPTIONS,
  type ExamKey,
  type MockExamCreate,
} from "@/types/exam";

const emptyForm: MockExamCreate = {
  exam: "ielts_academic",
  title: "",
  description: "",
  mode: "full",
  total_time_minutes: 60,
  reading_passage_id: null,
  listening_exercise_id: null,
  writing_prompt_id: null,
  speaking_prompt_id: null,
  is_published: true,
};

export default function AdminMockPanel() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<MockExamCreate>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const { data: mocks, isLoading } = useQuery({
    queryKey: ["admin-mock-exams"],
    queryFn: () => adminListMockExams(),
  });

  const { data: readings } = useQuery({
    queryKey: ["admin-reading-passages"],
    queryFn: () => adminListReadingPassages(),
  });
  const { data: listenings } = useQuery({
    queryKey: ["admin-listening-exercises"],
    queryFn: () => adminListListeningExercises(),
  });
  const { data: writings } = useQuery({
    queryKey: ["admin-writing-prompts"],
    queryFn: () => adminListPrompts(),
  });
  const { data: speakings } = useQuery({
    queryKey: ["admin-speaking-prompts"],
    queryFn: () => adminListSpeakingPrompts(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      adminCreateMockExam({
        ...form,
        title: form.title.trim(),
        description: form.description?.trim() || null,
        reading_passage_id: form.reading_passage_id || null,
        listening_exercise_id: form.listening_exercise_id || null,
        writing_prompt_id: form.writing_prompt_id || null,
        speaking_prompt_id: form.speaking_prompt_id || null,
      }),
    onSuccess: () => {
      setForm(emptyForm);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["admin-mock-exams"] });
    },
    onError: (err) =>
      setError(getApiErrorMessage(err, "Could not create mock exam.")),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_published }: { id: string; is_published: boolean }) =>
      adminUpdateMockExam(id, { is_published }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-mock-exams"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminDeleteMockExam(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-mock-exams"] }),
  });

  const hasSection =
    !!form.reading_passage_id ||
    !!form.listening_exercise_id ||
    !!form.writing_prompt_id ||
    !!form.speaking_prompt_id;

  const filterByExam = <T extends { exam: string }>(items: T[] | undefined) =>
    (items ?? []).filter((i) => i.exam === form.exam);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create mock exam</CardTitle>
          <CardDescription>
            Bundle published Reading, Listening, Writing, and/or Speaking content
            into a timed multi-section mock paper.
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
                  setForm((f) => ({
                    ...f,
                    exam: e.target.value as ExamKey,
                    reading_passage_id: null,
                    listening_exercise_id: null,
                    writing_prompt_id: null,
                    speaking_prompt_id: null,
                  }))
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
              <Label>Mode</Label>
              <select
                className="flex h-10 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 text-sm"
                value={form.mode}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    mode: e.target.value as "full" | "section",
                  }))
                }
              >
                <option value="full">Full (multi-skill)</option>
                <option value="section">Section-wise</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. IELTS Academic Mini Mock 1"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Total time (min)</Label>
              <Input
                type="number"
                value={form.total_time_minutes}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    total_time_minutes: Number(e.target.value) || 60,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                value={form.description ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reading passage</Label>
            <select
              className="flex h-10 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 text-sm"
              value={form.reading_passage_id ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  reading_passage_id: e.target.value || null,
                }))
              }
            >
              <option value="">— None —</option>
              {filterByExam(readings).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Listening exercise</Label>
            <select
              className="flex h-10 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 text-sm"
              value={form.listening_exercise_id ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  listening_exercise_id: e.target.value || null,
                }))
              }
            >
              <option value="">— None —</option>
              {filterByExam(listenings).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Writing prompt</Label>
            <select
              className="flex h-10 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 text-sm"
              value={form.writing_prompt_id ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  writing_prompt_id: e.target.value || null,
                }))
              }
            >
              <option value="">— None —</option>
              {filterByExam(writings).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Speaking prompt (optional)</Label>
            <select
              className="flex h-10 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 text-sm"
              value={form.speaking_prompt_id ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  speaking_prompt_id: e.target.value || null,
                }))
              }
            >
              <option value="">— None —</option>
              {filterByExam(speakings).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
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
              createMutation.isPending || !form.title.trim() || !hasSection
            }
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create mock exam
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mock exam library</CardTitle>
          <CardDescription>
            {mocks?.length ?? 0} mock{(mocks?.length ?? 0) === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !mocks?.length ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">
              No mock exams yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {mocks.map((m) => (
                <li
                  key={m.id}
                  className="rounded-md border border-[var(--color-border)] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{m.title}</p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        {m.exam} · {m.mode} · {m.total_time_minutes} min ·{" "}
                        {[
                          m.has_reading && "R",
                          m.has_listening && "L",
                          m.has_writing && "W",
                          m.has_speaking && "S",
                        ]
                          .filter(Boolean)
                          .join(" + ")}{" "}
                        · {m.is_published ? "Published" : "Draft"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={toggleMutation.isPending}
                        onClick={() =>
                          toggleMutation.mutate({
                            id: m.id,
                            is_published: !m.is_published,
                          })
                        }
                      >
                        {m.is_published ? "Unpublish" : "Publish"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (window.confirm(`Delete "${m.title}"?`)) {
                            deleteMutation.mutate(m.id);
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
