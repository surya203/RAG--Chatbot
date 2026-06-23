import { useQuery } from "@tanstack/react-query";
import { Loader2, Trophy, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getLeaderboard } from "@/services/quizzes";

interface LeaderboardModalProps {
  onClose: () => void;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardModal({ onClose }: LeaderboardModalProps) {
  const { data: entries, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: getLeaderboard,
  });

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

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-[var(--color-muted-foreground)]">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : !entries || entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
              No quiz attempts yet. Take a quiz to get on the board!
            </p>
          ) : (
            <ul className="space-y-1">
              {entries.map((e) => (
                <li
                  key={e.rank}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm odd:bg-slate-50"
                >
                  <span className="w-6 text-center font-semibold">
                    {MEDALS[e.rank - 1] ?? e.rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{e.name}</span>
                  <span className="text-xs text-[var(--color-muted-foreground)]">
                    {e.attempts} {e.attempts === 1 ? "quiz" : "quizzes"} · {e.avg_percentage}%
                  </span>
                  <span className="w-16 text-right font-semibold text-[var(--color-primary)]">
                    {e.points} pts
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
