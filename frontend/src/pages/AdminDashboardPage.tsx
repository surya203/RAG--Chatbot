import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  BookOpenCheck,
  CircleCheckBig,
  ClipboardList,
  FileText,
  Headphones,
  Loader2,
  LogOut,
  Mic,
  PenLine,
  Plus,
  Trash2,
} from "lucide-react";

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

const ADMIN_TABS: Array<{
  value: AdminTab;
  label: string;
  icon: typeof PenLine;
}> = [
  { value: "writing", label: "Writing prompts", icon: PenLine },
  { value: "speaking", label: "Speaking prompts", icon: Mic },
  { value: "reading", label: "Reading passages", icon: BookOpenCheck },
  { value: "listening", label: "Listening exercises", icon: Headphones },
  { value: "vocab", label: "Vocabulary", icon: BookOpenCheck },
  { value: "mocks", label: "Mock exams", icon: ClipboardList },
];

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
  const publishedCount = useMemo(
    () => (prompts ?? []).filter((p) => p.is_published).length,
    [prompts]
  );
  const draftCount = (prompts?.length ?? 0) - publishedCount;

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
    <div className="min-h-screen bg-[#f4f6f9] lg:pl-72">
      <aside className="bg-uk-navy p-4 shadow-2xl lg:fixed lg:inset-y-0 lg:left-0 lg:z-20 lg:w-72 lg:p-5">
        <div className="flex h-full flex-col">
          <div className="mb-5 border-b border-white/10 pb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-uk-red">
              Admin panel
            </p>
            <h1 className="mt-2 text-xl font-bold text-white">Admin Dashboard</h1>
            <p className="mt-1 text-xs text-slate-300">
              {user?.full_name ? `Signed in as ${user.full_name}` : "Content management"}
            </p>
          </div>

          <nav className="scrollbar-hide flex-1 space-y-2 overflow-y-auto pb-3">
            {ADMIN_TABS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.value;

              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setTab(item.value)}
                  className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                    active
                      ? "bg-uk-navy-light text-white shadow-sm ring-1 ring-white/10"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {active && (
                    <span className="absolute bottom-1.5 left-0 top-1.5 w-1 rounded-r bg-uk-red" />
                  )}
                  <Icon className={`h-4 w-4 ${active ? "text-uk-red" : ""}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-4 border-t border-white/10 pt-3">
            <Button
              variant="ghost"
              onClick={logout}
              className="w-full justify-start text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4 text-uk-red" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-uk-navy">
              {ADMIN_TABS.find((t) => t.value === tab)?.label ?? "Admin"}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              Manage exam practice content and publishing
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-0 bg-gradient-to-br from-uk-navy to-[#0b2e79] text-white shadow-lg">
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-100">
                  Total writing prompts
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-3xl font-bold">{prompts?.length ?? 0}</p>
                  <FileText className="h-5 w-5 text-blue-100" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-[var(--color-border)] bg-white shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                  Published
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-3xl font-bold text-uk-navy">{publishedCount}</p>
                  <CircleCheckBig className="h-5 w-5 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-[var(--color-border)] bg-white shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                  Draft items
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-3xl font-bold text-uk-navy">{Math.max(draftCount, 0)}</p>
                  <BarChart3 className="h-5 w-5 text-uk-red" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-[var(--color-border)] bg-gradient-to-r from-white to-red-50/40 shadow-sm">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <p className="text-sm font-semibold text-uk-navy">
                  Content quality checklist
                </p>
                <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                  Use clear instructions, realistic timing, and exam-specific wording
                  before publishing.
                </p>
              </div>
              <div className="rounded-lg bg-uk-red px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white">
                {ADMIN_TABS.find((t) => t.value === tab)?.label ?? "Section"}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6 [&_h3]:text-uk-navy [&_label]:font-medium [&_label]:text-uk-navy [&_select]:border-[var(--color-border)] [&_select]:bg-white [&_select]:text-uk-navy [&_select]:shadow-sm [&_textarea]:border-[var(--color-border)] [&_textarea]:bg-white [&_textarea]:text-uk-navy [&_textarea]:shadow-sm [&_input]:text-uk-navy">
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
        <Card className="border-[var(--color-border)] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-uk-navy">Add writing prompt</CardTitle>
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
                  className="flex h-10 w-full rounded-md border border-[var(--color-border)] bg-white px-3 text-sm text-uk-navy"
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
                  className="flex h-10 w-full rounded-md border border-[var(--color-border)] bg-white px-3 text-sm text-uk-navy"
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
                className="min-h-[140px] w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-uk-navy"
                value={form.prompt_text}
                onChange={(e) =>
                  setForm((f) => ({ ...f, prompt_text: e.target.value }))
                }
                placeholder="Paste the full writing task prompt students will answer…"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-uk-navy">
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

        <Card className="border-[var(--color-border)] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-uk-navy">Writing prompt library</CardTitle>
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
                    className="rounded-xl border border-[var(--color-border)] bg-[#fbfcfe] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-uk-navy">{p.title}</p>
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
                          className="border-uk-navy/15 text-uk-navy hover:bg-uk-navy/5"
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
                          className="hover:bg-uk-red/5"
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
      </div>
    </div>
  );
}
