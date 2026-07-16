import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookMarked,
  Check,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Link } from "react-router-dom";

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
  enrollVocabCard,
  enrollVocabTopic,
  getExamProfile,
  getVocabStats,
  listDueVocabCards,
  listVocabCards,
  reviewVocabCard,
} from "@/services/exam";
import { VOCAB_TOPIC_OPTIONS, type VocabRating, type VocabReviewCard } from "@/types/exam";

export default function VocabCoachPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"review" | "browse">("review");
  const [flipped, setFlipped] = useState(false);
  const [current, setCurrent] = useState<VocabReviewCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topicFilter, setTopicFilter] = useState<string>("");

  const { data: profile } = useQuery({
    queryKey: ["exam-profile"],
    queryFn: getExamProfile,
  });

  const { data: stats } = useQuery({
    queryKey: ["vocab-stats"],
    queryFn: getVocabStats,
  });

  const { data: dueCards, isLoading: dueLoading } = useQuery({
    queryKey: ["vocab-due"],
    queryFn: listDueVocabCards,
  });

  const { data: browseCards, isLoading: browseLoading } = useQuery({
    queryKey: ["vocab-cards", profile?.target_exam, topicFilter],
    queryFn: () =>
      listVocabCards(
        profile?.target_exam,
        topicFilter || undefined
      ),
    enabled: tab === "browse",
  });

  const reviewMutation = useMutation({
    mutationFn: ({ progressId, rating }: { progressId: string; rating: VocabRating }) =>
      reviewVocabCard(progressId, rating),
    onSuccess: () => {
      setFlipped(false);
      setCurrent(null);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["vocab-due"] });
      queryClient.invalidateQueries({ queryKey: ["vocab-stats"] });
      queryClient.invalidateQueries({ queryKey: ["progress-dashboard"] });
    },
    onError: (err) =>
      setError(getApiErrorMessage(err, "Could not save review.")),
  });

  const enrollMutation = useMutation({
    mutationFn: (cardId: string) => enrollVocabCard(cardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vocab-cards"] });
      queryClient.invalidateQueries({ queryKey: ["vocab-stats"] });
    },
  });

  const enrollTopicMutation = useMutation({
    mutationFn: (topic: string) => enrollVocabTopic(topic),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vocab-cards"] });
      queryClient.invalidateQueries({ queryKey: ["vocab-due"] });
      queryClient.invalidateQueries({ queryKey: ["vocab-stats"] });
    },
  });

  const activeCard = current ?? dueCards?.[0] ?? null;

  const ratingButtons: { rating: VocabRating; label: string; className: string }[] = [
    { rating: "again", label: "Again", className: "border-red-300 bg-red-50 hover:bg-red-100" },
    { rating: "hard", label: "Hard", className: "border-amber-300 bg-amber-50 hover:bg-amber-100" },
    { rating: "good", label: "Good", className: "border-green-300 bg-green-50 hover:bg-green-100" },
    { rating: "easy", label: "Easy", className: "border-blue-300 bg-blue-50 hover:bg-blue-100" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/progress">Progress dashboard</Link>
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold">{stats?.due ?? 0}</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">Due today</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold">{stats?.learning ?? 0}</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">In deck</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold">{stats?.mastered ?? 0}</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">Mastered</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold">{stats?.streak_days ?? 0}</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">Day streak</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-2">
          <Button
            variant={tab === "review" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("review")}
          >
            Review
          </Button>
          <Button
            variant={tab === "browse" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("browse")}
          >
            Browse &amp; enroll
          </Button>
        </div>

        {tab === "review" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookMarked className="h-5 w-5 text-[var(--color-primary)]" />
                Flashcard review
              </CardTitle>
              <CardDescription>
                Spaced repetition — cards reappear based on how well you remember them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {dueLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : !activeCard ? (
                <div className="py-12 text-center">
                  <Check className="mx-auto mb-3 h-8 w-8 text-green-600" />
                  <p className="font-medium">All caught up!</p>
                  <p className="text-sm text-[var(--color-muted-foreground)]">
                    No cards due right now. Browse the library to add more words.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setTab("browse")}
                  >
                    Browse vocabulary
                  </Button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setFlipped((f) => !f)}
                    className="w-full rounded-xl border-2 border-[var(--color-border)] bg-white p-8 text-center shadow-sm transition hover:border-[var(--color-primary)]"
                  >
                    <p className="mb-1 text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                      {activeCard.topic} · tap to flip
                    </p>
                    {!flipped ? (
                      <p className="text-3xl font-bold">{activeCard.word}</p>
                    ) : (
                      <div className="space-y-3 text-left">
                        <p className="text-lg font-medium">{activeCard.definition}</p>
                        {activeCard.example_sentence && (
                          <p className="text-sm italic text-[var(--color-muted-foreground)]">
                            &ldquo;{activeCard.example_sentence}&rdquo;
                          </p>
                        )}
                        {activeCard.collocations && activeCard.collocations.length > 0 && (
                          <p className="text-xs text-[var(--color-muted-foreground)]">
                            Collocations: {activeCard.collocations.join(", ")}
                          </p>
                        )}
                      </div>
                    )}
                  </button>

                  {flipped && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {ratingButtons.map((btn) => (
                        <Button
                          key={btn.rating}
                          variant="outline"
                          className={btn.className}
                          disabled={reviewMutation.isPending}
                          onClick={() =>
                            reviewMutation.mutate({
                              progressId: activeCard.progress_id,
                              rating: btn.rating,
                            })
                          }
                        >
                          {reviewMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            btn.label
                          )}
                        </Button>
                      ))}
                    </div>
                  )}

                  {!flipped && (
                    <p className="text-center text-xs text-[var(--color-muted-foreground)]">
                      Reveal the answer, then rate how well you knew it.
                    </p>
                  )}
                </>
              )}
              {error && (
                <p className="text-sm text-[var(--color-destructive)]">{error}</p>
              )}
            </CardContent>
          </Card>
        )}

        {tab === "browse" && (
          <Card>
            <CardHeader>
              <CardTitle>Vocabulary library</CardTitle>
              <CardDescription>
                Add topic decks to your spaced-repetition queue.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <select
                  className="flex h-9 rounded-md border border-[var(--color-border)] bg-transparent px-3 text-sm"
                  value={topicFilter}
                  onChange={(e) => setTopicFilter(e.target.value)}
                >
                  <option value="">All topics</option>
                  {VOCAB_TOPIC_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {topicFilter && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={enrollTopicMutation.isPending}
                    onClick={() => enrollTopicMutation.mutate(topicFilter)}
                  >
                    {enrollTopicMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    Enroll all in {topicFilter}
                  </Button>
                )}
              </div>

              {browseLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : !browseCards?.length ? (
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  No published cards found.
                </p>
              ) : (
                <ul className="space-y-2">
                  {browseCards.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border)] p-3"
                    >
                      <div>
                        <p className="font-medium">{c.word}</p>
                        <p className="text-xs text-[var(--color-muted-foreground)]">
                          {c.topic} · {c.definition.slice(0, 80)}
                          {c.definition.length > 80 ? "…" : ""}
                        </p>
                      </div>
                      {c.in_my_deck ? (
                        <span className="text-xs text-green-600">In deck</span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={enrollMutation.isPending}
                          onClick={() => enrollMutation.mutate(c.id)}
                        >
                          Add
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
