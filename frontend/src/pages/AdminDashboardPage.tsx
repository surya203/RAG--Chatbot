import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut, Plus, Trash2 } from "lucide-react";

import AdminMockPanel from "@/components/AdminMockPanel";
import AdminVocabPanel from "@/components/AdminVocabPanel";
import AdminListeningPanel from "@/components/AdminListeningPanel";
import AdminReadingPanel from "@/components/AdminReadingPanel";
import AdminSpeakingPanel from "@/components/AdminSpeakingPanel";
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
import { useAuth } from "@/context/AuthContext";
import { getApiErrorMessage } from "@/lib/api";
import {
  adminCreatePrompt,
  adminDeletePrompt,
  adminListPrompts,
  adminUpdatePrompt,
} from "@/services/exam";
import {
  EXAM_OPTIONS,
  TASK_OPTIONS,
  type ExamKey,
  type WritingPromptInput,
  type WritingTaskType,
} from "@/types/exam";

type AdminTab = "writing" | "speaking" | "reading" | "listening" | "vocab" | "mocks";

const emptyForm: WritingPromptInput = {
  exam: "ielts_academic",
  task_type: "ielts_task2",
  title: "",
  prompt_text: "",
  topic: "",
  time_limit_minutes: 40,
  min_words: 250,
  is_published: true,
};

export default function AdminDashboardPage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AdminTab>("writing");
  const [form, setForm] = useState<WritingPromptInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const { data: prompts, isLoading } = useQuery({
    queryKey: ["admin-writing-prompts"],
    queryFn: () => adminListPrompts(),
  });

  const taskChoices = useMemo(
    () => TASK_OPTIONS.filter((t) => t.exams.includes(form.exam)),
    [form.exam]
  );

  const createMutation = useMutation({
    mutationFn: () =>
      adminCreatePrompt({
        ...form,
        title: form.title.trim(),
        prompt_text: form.prompt_text.trim(),
        topic: form.topic?.trim() || null,
      }),
    onSuccess: () => {
      setForm(emptyForm);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["admin-writing-prompts"] });
    },
    onError: (err) => setError(getApiErrorMessage(err, "Could not create prompt.")),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_published }: { id: string; is_published: boolean }) =>
      adminUpdatePrompt(id, { is_published }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-writing-prompts"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminDeletePrompt(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-writing-prompts"] }),
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-[var(--color-muted-foreground)]">
              Manage exam practice content
              {user?.full_name ? ` · ${user.full_name}` : ""}
            </p>
          </div>
          <Button variant="outline" onClick={logout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>

        <div className="flex gap-2 border-b border-[var(--color-border)] pb-2">
          <Button
            variant={tab === "writing" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("writing")}
          >
            Writing prompts
          </Button>
          <Button
            variant={tab === "speaking" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("speaking")}
          >
            Speaking prompts
          </Button>
          <Button
            variant={tab === "reading" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("reading")}
          >
            Reading passages
          </Button>
          <Button
            variant={tab === "listening" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("listening")}
          >
            Listening exercises
          </Button>
          <Button
            variant={tab === "vocab" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("vocab")}
          >
            Vocabulary
          </Button>
          <Button
            variant={tab === "mocks" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("mocks")}
          >
            Mock exams
          </Button>
        </div>

        {tab === "speaking" ? (
          <AdminSpeakingPanel />
        ) : tab === "reading" ? (
          <AdminReadingPanel />
        ) : tab === "listening" ? (
          <AdminListeningPanel />
        ) : tab === "vocab" ? (
          <AdminVocabPanel />
        ) : tab === "mocks" ? (
          <AdminMockPanel />
        ) : (
          <>
        <Card>
          <CardHeader>
            <CardTitle>Add writing prompt</CardTitle>
            <CardDescription>
              Students will see published prompts in the Writing Coach.
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
                    const tasks = TASK_OPTIONS.filter((t) => t.exams.includes(exam));
                    setForm((f) => ({
                      ...f,
                      exam,
                      task_type: tasks[0]?.value ?? f.task_type,
                      time_limit_minutes:
                        tasks[0]?.value === "ielts_task1" ? 20 : 40,
                      min_words: tasks[0]?.value === "ielts_task1" ? 150 : 250,
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
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      task_type: e.target.value as WritingTaskType,
                    }))
                  }
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
                placeholder="e.g. Technology in education"
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
                      time_limit_minutes: Number(e.target.value) || 40,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Min words</Label>
                <Input
                  type="number"
                  value={form.min_words ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      min_words: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Prompt text</Label>
              <textarea
                className="min-h-[140px] w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
                value={form.prompt_text}
                onChange={(e) =>
                  setForm((f) => ({ ...f, prompt_text: e.target.value }))
                }
                placeholder="Paste the full writing task prompt students will answer…"
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
              Add prompt
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Writing prompt library</CardTitle>
            <CardDescription>
              {prompts?.length ?? 0} prompt{(prompts?.length ?? 0) === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : !prompts?.length ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                No prompts yet. Add one above.
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
                          {p.topic ? ` · ${p.topic}` : ""} · {p.time_limit_minutes} min
                          {p.min_words ? ` · ${p.min_words}+ words` : ""}
                          {" · "}
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
          </>
        )}
      </div>
    </div>
  );
}
