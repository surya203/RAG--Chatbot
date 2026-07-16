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
  adminCreateVocabCard,
  adminDeleteVocabCard,
  adminListVocabCards,
  adminUpdateVocabCard,
} from "@/services/exam";
import {
  EXAM_OPTIONS,
  VOCAB_TOPIC_OPTIONS,
  type ExamKey,
  type VocabCardInput,
} from "@/types/exam";

const emptyForm: VocabCardInput = {
  exam: "ielts_academic",
  topic: "education",
  word: "",
  definition: "",
  example_sentence: "",
  collocations: [],
  is_published: true,
};

export default function AdminVocabPanel() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<VocabCardInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const { data: cards, isLoading } = useQuery({
    queryKey: ["admin-vocab-cards"],
    queryFn: () => adminListVocabCards(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      adminCreateVocabCard({
        ...form,
        word: form.word.trim(),
        definition: form.definition.trim(),
        example_sentence: form.example_sentence?.trim() || null,
        collocations:
          form.collocations?.filter((c) => c.trim()).map((c) => c.trim()) ?? null,
      }),
    onSuccess: () => {
      setForm(emptyForm);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["admin-vocab-cards"] });
    },
    onError: (err) =>
      setError(getApiErrorMessage(err, "Could not create vocab card.")),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_published }: { id: string; is_published: boolean }) =>
      adminUpdateVocabCard(id, { is_published }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-vocab-cards"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminDeleteVocabCard(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-vocab-cards"] }),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add vocabulary card</CardTitle>
          <CardDescription>
            Publish exam-focused flashcards for spaced-repetition review.
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
              <Label>Topic</Label>
              <select
                className="flex h-10 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 text-sm"
                value={form.topic}
                onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
              >
                {VOCAB_TOPIC_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Word</Label>
            <Input
              value={form.word}
              onChange={(e) => setForm((f) => ({ ...f, word: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Definition</Label>
            <textarea
              className="min-h-[70px] w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
              value={form.definition}
              onChange={(e) =>
                setForm((f) => ({ ...f, definition: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Example sentence (optional)</Label>
            <Input
              value={form.example_sentence ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, example_sentence: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Collocations (comma-separated, optional)</Label>
            <Input
              placeholder="e.g. sustainable development, boost productivity"
              value={(form.collocations ?? []).join(", ")}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  collocations: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                }))
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
            Publish immediately
          </label>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={
              createMutation.isPending ||
              !form.word.trim() ||
              !form.definition.trim()
            }
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add card
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vocabulary library</CardTitle>
          <CardDescription>
            {cards?.length ?? 0} card{(cards?.length ?? 0) === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !cards?.length ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">
              No vocabulary cards yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {cards.map((c) => (
                <li
                  key={c.id}
                  className="rounded-md border border-[var(--color-border)] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{c.word}</p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        {c.exam} · {c.topic} ·{" "}
                        {c.is_published ? "Published" : "Draft"}
                      </p>
                      <p className="mt-1 text-sm">{c.definition}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={toggleMutation.isPending}
                        onClick={() =>
                          toggleMutation.mutate({
                            id: c.id,
                            is_published: !c.is_published,
                          })
                        }
                      >
                        {c.is_published ? "Unpublish" : "Publish"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (window.confirm(`Delete "${c.word}"?`)) {
                            deleteMutation.mutate(c.id);
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
