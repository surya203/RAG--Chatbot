import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Flame,
  Headphones,
  Loader2,
  Mic,
  PenLine,
  Target,
  TrendingUp,
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
import { getProgressDashboard } from "@/services/exam";

function SkillBar({
  label,
  value,
  max,
  unit,
  icon,
}: {
  label: string;
  value: number | null;
  max: number;
  unit: string;
  icon: ReactNode;
}) {
  const pct = value != null ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-medium">
          {icon}
          {label}
        </span>
        <span className="text-[var(--color-muted-foreground)]">
          {value != null ? `${value}${unit}` : "No data yet"}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-[var(--color-primary)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function ProgressPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["progress-dashboard"],
    queryFn: getProgressDashboard,
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/exam-profile">Exam profile</Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : isError || !data ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-[var(--color-destructive)]">
              Could not load progress data.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="flex items-center gap-3 py-4">
                  <Flame className="h-8 w-8 text-orange-500" />
                  <div>
                    <p className="text-2xl font-bold">{data.streak_days}</p>
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      Day streak
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 py-4">
                  <TrendingUp className="h-8 w-8 text-[var(--color-primary)]" />
                  <div>
                    <p className="text-2xl font-bold">
                      {data.estimated_band ?? "—"}
                    </p>
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      Est. band
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 py-4">
                  <Calendar className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">
                      {data.days_to_exam ?? "—"}
                    </p>
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      Days to exam
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 py-4">
                  <Target className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold">
                      {data.goals_completed_today}/{data.goals_total_today}
                    </p>
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      Today&apos;s goals
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {(data.target_exam || data.exam_date) && (
              <Card>
                <CardContent className="py-4 text-sm">
                  <span className="font-medium">Target: </span>
                  {data.target_exam?.replace(/_/g, " ")}
                  {data.target_score ? ` · ${data.target_score}` : ""}
                  {data.exam_date ? ` · Exam on ${data.exam_date}` : ""}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Skill breakdown</CardTitle>
                <CardDescription>
                  Based on your recent practice attempts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <SkillBar
                  label="Writing"
                  value={data.skills.writing.avg_band}
                  max={9}
                  unit=""
                  icon={<PenLine className="h-4 w-4" />}
                />
                <SkillBar
                  label="Speaking"
                  value={data.skills.speaking.avg_band}
                  max={9}
                  unit=""
                  icon={<Mic className="h-4 w-4" />}
                />
                <SkillBar
                  label="Reading"
                  value={data.skills.reading.avg_percentage}
                  max={100}
                  unit="%"
                  icon={<BookOpen className="h-4 w-4" />}
                />
                <SkillBar
                  label="Listening"
                  value={data.skills.listening.avg_percentage}
                  max={100}
                  unit="%"
                  icon={<Headphones className="h-4 w-4" />}
                />
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  Vocabulary: {data.skills.vocab.learning} learning ·{" "}
                  {data.skills.vocab.due} due · {data.skills.vocab.mastered}{" "}
                  mastered
                </p>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Today&apos;s goals</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {data.daily_goals.map((g) => (
                      <li
                        key={g.skill}
                        className="flex items-center justify-between rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                      >
                        <span>{g.label}</span>
                        <span
                          className={
                            g.completed >= g.target
                              ? "font-medium text-green-600"
                              : "text-[var(--color-muted-foreground)]"
                          }
                        >
                          {g.completed}/{g.target}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {data.recommendations.map((r, i) => (
                      <li
                        key={i}
                        className="rounded-md bg-amber-50/80 px-3 py-2"
                      >
                        {r}
                      </li>
                    ))}
                  </ul>
                  {data.focus_skills.length > 0 && (
                    <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
                      Focus this week: {data.focus_skills.join(", ")}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {data.weak_areas.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Weak areas</CardTitle>
                  <CardDescription>
                    Question types you miss most often.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {data.weak_areas.map((w) => (
                      <li
                        key={w.question_type}
                        className="flex items-center justify-between rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                      >
                        <span>{w.area}</span>
                        <span className="text-[var(--color-destructive)]">
                          {w.miss_rate}% miss rate
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Weekly study plan</CardTitle>
                <CardDescription>
                  Personalized schedule based on your weakest skills.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.weekly_plan.map((day) => (
                    <div
                      key={day.day}
                      className="rounded-md border border-[var(--color-border)] p-3"
                    >
                      <p className="mb-2 font-semibold">{day.day}</p>
                      <ul className="space-y-1 text-xs text-[var(--color-muted-foreground)]">
                        {day.tasks.map((t, i) => (
                          <li key={i}>• {t}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <p className="text-center text-xs text-[var(--color-muted-foreground)]">
              {data.disclaimer}
            </p>

            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/vocab">Vocabulary SRS</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/writing">Writing</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/speaking">Speaking</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/reading">Reading</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/listening">Listening</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
