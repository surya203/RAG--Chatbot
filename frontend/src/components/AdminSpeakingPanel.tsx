import { useMemo, useState } from "react";
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
  adminCreateSpeakingPrompt,
  adminDeleteSpeakingPrompt,
  adminListSpeakingPrompts,
  adminUpdateSpeakingPrompt,
} from "@/services/exam";
import {
  EXAM_OPTIONS,
  SPEAKING_TASK_OPTIONS,
  type ExamKey,
  type SpeakingPromptInput,
  type SpeakingTaskType,
} from "@/types/exam";

const emptyForm: SpeakingPromptInput = {
  exam: "ielts_academic",
  task_type: "ielts_part2",
  title: "",
  prompt_text: "",
  cue_points: "",
  model_answer: "",
  topic: "",
  prep_seconds: 60,
  speak_seconds: 120,
  is_published: true,
};

export default function AdminSpeakingPanel() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SpeakingPromptInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const { data: prompts, isLoading } = useQuery({
    queryKey: ["admin-speaking-prompts"],
    queryFn: () => adminListSpeakingPrompts(),
  });

  const taskChoices = useMemo(
    () => SPEAKING_TASK_OPTIONS.filter((t) => t.exams.includes(form.exam)),
    [form.exam]
  );

  const createMutation = useMutation({
    mutationFn: () =>
      adminCreateSpeakingPrompt({
        ...form,
        title: form.title.trim(),
        prompt_text: form.prompt_text.trim(),
        cue_points: form.cue_points?.trim() || null,
        model_answer: form.model_answer?.trim() || null,
        topic: form.topic?.trim() || null,
      }),
    onSuccess: () => {
      setForm(emptyForm);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["admin-speaking-prompts"] });
    },
    onError: (err) =>
      setError(getApiErrorMessage(err, "Could not create speaking prompt.")),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_published }: { id: string; is_published: boolean }) =>
      adminUpdateSpeakingPrompt(id, { is_published }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-speaking-prompts"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminDeleteSpeakingPrompt(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-speaking-prompts"] }),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add speaking prompt</CardTitle>
          <CardDescription>
            Students practice these in the Speaking Coach with prep/speak timers.
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
                onChange={(e) => {
                  const exam = e.target.value as ExamKey;
                  const tasks = SPEAKING_TASK_OPTIONS.filter((t) =>
                    t.exams.includes(exam)
                  );
                  const first = tasks[0];
                  setForm((f) => ({
                    ...f,
                    exam,
                    task_type: first?.value ?? f.task_type,
                    prep_seconds: first?.defaultPrep ?? 0,
                    speak_seconds: first?.defaultSpeak ?? 120,
                  }));
                }}
              >
                {EXAM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Task type</Label>
              <select
                className="flex h-10 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 text-sm"
                value={form.task_type}
                onChange={(e) => {
                  const task_type = e.target.value as SpeakingTaskType;
                  const meta = SPEAKING_TASK_OPTIONS.find(
                    (t) => t.value === task_type
                  );
                  setForm((f) => ({
                    ...f,
                    task_type,
                    prep_seconds: meta?.defaultPrep ?? f.prep_seconds,
                    speak_seconds: meta?.defaultSpeak ?? f.speak_seconds,
                  }));
                }}
              >
                {taskChoices.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. A skill you want to learn"
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
              <Label>Prep seconds</Label>
              <Input
                type="number"
                value={form.prep_seconds}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    prep_seconds: Number(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Speak seconds</Label>
              <Input
                type="number"
                value={form.speak_seconds}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    speak_seconds: Number(e.target.value) || 120,
                  }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Prompt text</Label>
            <textarea
              className="min-h-[120px] w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
              value={form.prompt_text}
              onChange={(e) =>
                setForm((f) => ({ ...f, prompt_text: e.target.value }))
              }
              placeholder="Cue card / questions students will answer…"
            />
          </div>
          <div className="space-y-2">
            <Label>Cue points (optional)</Label>
            <textarea
              className="min-h-[80px] w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
              value={form.cue_points ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, cue_points: e.target.value }))
              }
              placeholder="- what …&#10;- why …"
            />
          </div>
          <div className="space-y-2">
            <Label>Model answer script (optional)</Label>
            <textarea
              className="min-h-[80px] w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
              value={form.model_answer ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, model_answer: e.target.value }))
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(e) =>
                setForm((f) => ({ ...f, is_published: e.target.checked }))
              }
            />
            Publish immediately (visible to students)
          </label>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={
              createMutation.isPending ||
              !form.title.trim() ||
              form.prompt_text.trim().length < 10
            }
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add speaking prompt
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Speaking prompt library</CardTitle>
          <CardDescription>
            {prompts?.length ?? 0} prompt
            {(prompts?.length ?? 0) === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !prompts?.length ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">
              No speaking prompts yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {prompts.map((p) => (
                <li
                  key={p.id}
                  className="rounded-md border border-[var(--color-border)] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{p.title}</p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        {p.exam} · {p.task_type}
                        {p.topic ? ` · ${p.topic}` : ""} · prep {p.prep_seconds}s ·
                        speak {p.speak_seconds}s ·{" "}
                        {p.is_published ? "Published" : "Draft"}
                      </p>
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm">
                        {p.prompt_text}
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
