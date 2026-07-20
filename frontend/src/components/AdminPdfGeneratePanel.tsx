import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Sparkles, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api";
import {
  adminGenerateFromPdf,
  type GenerateFeature,
  type GenerateFromPdfResult,
} from "@/services/exam";
import { EXAM_OPTIONS, type ExamKey } from "@/types/exam";

const FEATURE_OPTIONS: { value: GenerateFeature; label: string; hint: string }[] =
  [
    {
      value: "writing",
      label: "Writing prompts",
      hint: "Creates a published writing task from the PDF themes",
    },
    {
      value: "speaking",
      label: "Speaking prompts",
      hint: "Creates a published speaking cue card",
    },
    {
      value: "reading",
      label: "Reading passages",
      hint: "Creates a passage + questions",
    },
    {
      value: "listening",
      label: "Listening exercises",
      hint: "Creates transcript, questions, and auto TTS audio",
    },
    {
      value: "vocab",
      label: "Vocabulary",
      hint: "Extracts vocabulary cards",
    },
    {
      value: "mocks",
      label: "Mock exams",
      hint: "Bundles generated skill sections into a mock",
    },
  ];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminPdfGeneratePanel() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [exam, setExam] = useState<ExamKey>("ielts_academic");
  const [features, setFeatures] = useState<GenerateFeature[]>([
    "writing",
    "speaking",
    "reading",
    "listening",
    "vocab",
  ]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateFromPdfResult | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Choose a PDF first.");
      return adminGenerateFromPdf({ file, exam, features });
    },
    onMutate: () => {
      setError(null);
      setResult(null);
    },
    onSuccess: (data) => {
      setResult(data);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      // Refresh all admin content lists so new items appear in feature tabs.
      queryClient.invalidateQueries({ queryKey: ["admin-writing-prompts"] });
      queryClient.invalidateQueries({ queryKey: ["admin-speaking-prompts"] });
      queryClient.invalidateQueries({ queryKey: ["admin-reading-passages"] });
      queryClient.invalidateQueries({ queryKey: ["admin-listening-exercises"] });
      queryClient.invalidateQueries({ queryKey: ["admin-vocab-cards"] });
      queryClient.invalidateQueries({ queryKey: ["admin-mock-exams"] });
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, "Generation failed. Please try again."));
    },
  });

  const toggleFeature = (value: GenerateFeature) => {
    setFeatures((prev) =>
      prev.includes(value) ? prev.filter((f) => f !== value) : [...prev, value]
    );
  };

  const pickFile = (incoming: FileList | null) => {
    if (!incoming?.length) return;
    const pdf = Array.from(incoming).find(
      (f) =>
        f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (pdf) setFile(pdf);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card className="border-[var(--color-border)] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-uk-navy">
            <Upload className="h-5 w-5 text-uk-red" />
            Upload PDF &amp; generate
          </CardTitle>
          <CardDescription>
            The PDF is used only as a source. Clicking{" "}
            <span className="font-medium text-uk-navy">Upload &amp; Generate</span>{" "}
            creates <span className="font-medium">published</span> content in the
            features you select. If you leave without submitting, nothing is
            created.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="gen-exam">Target exam</Label>
            <select
              id="gen-exam"
              className="flex h-10 w-full rounded-md border border-[var(--color-border)] bg-white px-3 text-sm text-uk-navy"
              value={exam}
              disabled={mutation.isPending}
              onChange={(e) => setExam(e.target.value as ExamKey)}
            >
              {EXAM_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-uk-navy/20 p-6 text-center transition-colors hover:border-uk-navy/40 hover:bg-uk-navy/5"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pickFile(e.dataTransfer.files);
            }}
          >
            <Upload className="mb-2 h-6 w-6 text-uk-navy/50" />
            <p className="text-sm font-medium text-uk-navy">
              Click to choose a PDF or drag it here
            </p>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              PDF only · used as generation source (not stored in student library)
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              disabled={mutation.isPending}
              onChange={(e) => pickFile(e.target.files)}
            />
          </div>

          {file && (
            <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-uk-red" />
                <span className="truncate">{file.name}</span>
                <span className="shrink-0 text-xs text-[var(--color-muted-foreground)]">
                  {formatBytes(file.size)}
                </span>
              </span>
              {!mutation.isPending && (
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                  className="text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)]"
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Generate into features</Label>
            <ul className="space-y-2">
              {FEATURE_OPTIONS.map((opt) => (
                <li key={opt.value}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-md border border-[var(--color-border)] px-3 py-2.5 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="mt-1 rounded"
                      checked={features.includes(opt.value)}
                      disabled={mutation.isPending}
                      onChange={() => toggleFeature(opt.value)}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-uk-navy">
                        {opt.label}
                      </span>
                      <span className="block text-xs text-[var(--color-muted-foreground)]">
                        {opt.hint}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          {error && (
            <p className="text-sm text-[var(--color-destructive)]">{error}</p>
          )}

          <Button
            className="w-full bg-uk-red shadow-sm hover:bg-uk-red-dark"
            disabled={!file || features.length === 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating published content…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Upload &amp; Generate
              </>
            )}
          </Button>
          {mutation.isPending && (
            <p className="text-center text-xs text-[var(--color-muted-foreground)]">
              This can take 1–3 minutes (especially listening audio). Keep this
              tab open.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="h-fit border-[var(--color-border)] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-uk-navy">Result</CardTitle>
          <CardDescription>
            After generation, open each feature tab to review or edit the new
            items.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!result ? (
            <p className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
              No generation yet. Select features, choose a PDF, then click Upload
              &amp; Generate.
            </p>
          ) : (
            <div className="space-y-4 text-sm">
              <p className="rounded-md bg-green-50 px-3 py-2 text-green-800">
                Published from <strong>{result.source_name}</strong> (
                {result.source_chars.toLocaleString()} chars of source text).
              </p>
              <ul className="space-y-2">
                {Object.entries(result.created).map(([feature, ids]) => (
                  <li
                    key={feature}
                    className="rounded-md border border-[var(--color-border)] px-3 py-2"
                  >
                    <span className="font-medium capitalize text-uk-navy">
                      {feature}
                    </span>
                    <span className="text-[var(--color-muted-foreground)]">
                      {" "}
                      · {ids.length} item{ids.length === 1 ? "" : "s"} created
                    </span>
                  </li>
                ))}
              </ul>
              {result.errors.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                  <p className="mb-1 font-medium">Partial errors</p>
                  <ul className="list-disc space-y-1 pl-4 text-xs">
                    {result.errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
