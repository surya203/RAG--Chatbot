import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Trophy, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getExamProfile, getExamLeaderboard } from "@/services/exam";
import { getLeaderboard } from "@/services/quizzes";
import { EXAM_OPTIONS } from "@/types/exam";

interface LeaderboardModalProps {
  onClose: () => void;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardModal({ onClose }: LeaderboardModalProps) {
  const [tab, setTab] = useState<"quiz" | "exam">("exam");
  const [examFilter, setExamFilter] = useState<string>("");

  const { data: profile } = useQuery({
    queryKey: ["exam-profile"],
    queryFn: getExamProfile,
  });

  const activeExam = examFilter || profile?.target_exam || undefined;

  const { data: quizEntries, isLoading: quizLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: getLeaderboard,
    enabled: tab === "quiz",
  });

  const { data: examEntries, isLoading: examLoading } = useQuery({
    queryKey: ["exam-leaderboard", activeExam ?? "all"],
    queryFn: () => getExamLeaderboard(activeExam),
    enabled: tab === "exam",
  });

  const isLoading = tab === "quiz" ? quizLoading : examLoading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Trophy className="h-4 w-4 text-amber-500" />
            Leaderboard
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2 border-b border-[var(--color-border)] px-4 py-2">
          <Button
            size="sm"
            variant={tab === "exam" ? "default" : "outline"}
            onClick={() => setTab("exam")}
          >
            Exam / Mocks
          </Button>
          <Button
            size="sm"
            variant={tab === "quiz" ? "default" : "outline"}
            onClick={() => setTab("quiz")}
          >
            Quiz points
          </Button>
        </div>

        {tab === "exam" && (
          <div className="border-b border-[var(--color-border)] px-4 py-2">
            <select
              className="flex h-8 w-full rounded-md border border-[var(--color-border)] bg-transparent px-2 text-xs"
              value={examFilter || profile?.target_exam || ""}
              onChange={(e) => setExamFilter(e.target.value)}
            >
              <option value="">All exams</option>
              {EXAM_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-[var(--color-muted-foreground)]">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : tab === "quiz" ? (
            !quizEntries || quizEntries.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
                No quiz attempts yet. Take a quiz to get on the board!
              </p>
            ) : (
              <ul className="space-y-1">
                {quizEntries.map((e) => (
                  <li
                    key={e.rank}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm odd:bg-slate-50"
                  >
                    <span className="w-6 text-center font-semibold">
                      {MEDALS[e.rank - 1] ?? e.rank}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {e.name}
                    </span>
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      {e.attempts} {e.attempts === 1 ? "quiz" : "quizzes"} ·{" "}
                      {e.avg_percentage}%
                    </span>
                    <span className="w-16 text-right font-semibold text-[var(--color-primary)]">
                      {e.points} pts
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : !examEntries || examEntries.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
              No mock attempts yet. Complete a mock exam to rank!
            </p>
          ) : (
            <ul className="space-y-1">
              {examEntries.map((e) => (
                <li
                  key={`${e.rank}-${e.name}-${e.exam}`}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm odd:bg-slate-50"
                >
                  <span className="w-6 text-center font-semibold">
                    {MEDALS[e.rank - 1] ?? e.rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {e.name}
                  </span>
                  <span className="text-xs text-[var(--color-muted-foreground)]">
                    band {e.best_overall_band ?? "—"} · {e.mock_attempts} mock
                    {e.mock_attempts === 1 ? "" : "s"}
                    {e.writing_avg_band != null
                      ? ` · W ${e.writing_avg_band}`
                      : ""}
                  </span>
                  <span className="w-16 text-right font-semibold text-[var(--color-primary)]">
                    {e.total_points} pts
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
