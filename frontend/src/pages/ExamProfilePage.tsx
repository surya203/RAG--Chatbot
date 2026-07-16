import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Target } from "lucide-react";

import StudentPageShell from "@/components/StudentPageShell";
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
import { getExamProfile, saveExamProfile } from "@/services/exam";
import { EXAM_OPTIONS, type ExamKey } from "@/types/exam";

export default function ExamProfilePage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["exam-profile"],
    queryFn: getExamProfile,
  });

  const [exam, setExam] = useState<ExamKey>("ielts_academic");
  const [targetScore, setTargetScore] = useState("");
  const [examDate, setExamDate] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setExam(data.target_exam);
    setTargetScore(data.target_score ?? "");
    setExamDate(data.exam_date ?? "");
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      saveExamProfile({
        target_exam: exam,
        target_score: targetScore.trim() || null,
        exam_date: examDate || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exam-profile"] });
      setMessage("Exam profile saved.");
      setError(null);
    },
    onError: (err) => {
      setMessage(null);
      setError(getApiErrorMessage(err, "Could not save profile."));
    },
  });

  return (
    <StudentPageShell
      title="Exam profile"
      description="Tell us which exam you are preparing for so practice can be tailored."
      maxWidth="xl"
    >
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-[var(--color-primary)]" />
              Your target exam
            </CardTitle>
            <CardDescription>
              Used to filter prompts, mocks, and vocabulary decks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Target exam</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 text-sm"
                    value={exam}
                    onChange={(e) => setExam(e.target.value as ExamKey)}
                  >
                    {EXAM_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Target score (optional)</Label>
                  <Input
                    placeholder="e.g. 7.0 / 100 / 79"
                    value={targetScore}
                    onChange={(e) => setTargetScore(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Exam date (optional)</Label>
                  <Input
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                  />
                </div>
                {message && <p className="text-sm text-green-700">{message}</p>}
                {error && (
                  <p className="text-sm text-[var(--color-destructive)]">{error}</p>
                )}
                <Button
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Save profile
                </Button>
              </>
            )}
          </CardContent>
        </Card>
    </StudentPageShell>
  );
}
