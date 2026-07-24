import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  FileText,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import GenerationPdfPreview from "@/components/GenerationPdfPreview";
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
  adminDeleteGenerationSource,
  adminGenerateFeature,
  adminListGenerationSources,
  adminPrepareFromPdf,
  type GenerateFeature,
  type GenerateFromPdfResult,
  type GenerationSource,
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

function examLabel(exam: string): string {
  return EXAM_OPTIONS.find((o) => o.value === exam)?.label ?? exam;
}

function formatWhen(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
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
  const [preview, setPreview] = useState<GenerationSource | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const { data: sources, isLoading: sourcesLoading } = useQuery({
    queryKey: ["admin-generation-sources"],
    queryFn: adminListGenerationSources,
  });

  const invalidateFeatureLists = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-writing-prompts"] });
    queryClient.invalidateQueries({ queryKey: ["admin-speaking-prompts"] });
    queryClient.invalidateQueries({ queryKey: ["admin-reading-passages"] });
    queryClient.invalidateQueries({ queryKey: ["admin-listening-exercises"] });
    queryClient.invalidateQueries({ queryKey: ["admin-vocab-cards"] });
    queryClient.invalidateQueries({ queryKey: ["admin-mock-exams"] });
    queryClient.invalidateQueries({ queryKey: ["admin-generation-sources"] });
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a PDF first.");
      const order: GenerateFeature[] = [
        "writing",
        "speaking",
        "reading",
        "listening",
        "vocab",
        "mocks",
      ];
      const selected = order.filter((f) => features.includes(f));

      setProgress("Uploading & extracting PDF text…");
      const prepared = await adminPrepareFromPdf({ file, exam, features: selected });

      let created: Record<string, string[]> = {};
      const errors: string[] = [];
      let status = prepared.status;

      for (let i = 0; i < selected.length; i++) {
        const feature = selected[i];
        setProgress(
          `Generating ${feature}… (${i + 1}/${selected.length})`
        );
        const step = await adminGenerateFeature(prepared.source_id, feature);
        created = step.created_items;
        errors.splice(0, errors.length, ...step.errors);
        status = step.status;
      }

      if (Object.keys(created).length === 0 && errors.length > 0) {
        throw new Error(errors.join(" · "));
      }

      return {
        created,
        errors,
        source_chars: prepared.source_chars,
        source_name: prepared.source_name,
        published: true,
        source_id: prepared.source_id,
        status,
      } satisfies GenerateFromPdfResult;
    },
    onMutate: () => {
      setError(null);
      setResult(null);
      setProgress(null);
    },
    onSuccess: (data) => {
      setResult(data);
      setFile(null);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
      invalidateFeatureLists();
    },
    onError: (err) => {
      setProgress(null);
      setError(getApiErrorMessage(err, "Generation failed. Please try again."));
      invalidateFeatureLists();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminDeleteGenerationSource(id),
    onSuccess: () => {
      invalidateFeatureLists();
      if (preview) setPreview(null);
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
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-[var(--color-border)] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-uk-navy">
              <Upload className="h-5 w-5 text-uk-red" />
              Upload PDF &amp; generate
            </CardTitle>
            <CardDescription>
              Clicking{" "}
              <span className="font-medium text-uk-navy">Upload &amp; Generate</span>{" "}
              creates <span className="font-medium">published</span> content and
              saves the PDF in <span className="font-medium">Source PDFs</span>{" "}
              below (not in the student library).
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
                PDF only · stored for admin history after generate
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
                {progress ?? "Generating…"}
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
              Generating one feature at a time so production (Render) does not
              time out. Keep this tab open — listening audio is the slowest step.
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

      <Card className="border-[var(--color-border)] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-uk-navy">
            <FileText className="h-5 w-5 text-uk-red" />
            Source PDFs
          </CardTitle>
          <CardDescription>
            View or delete PDFs used for generation. Deleting a PDF also removes
            the practice content created from it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sourcesLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-uk-navy" />
            </div>
          ) : !sources?.length ? (
            <p className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
              No source PDFs yet. After you Upload &amp; Generate, they appear
              here.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
              {sources.map((src) => (
                <li
                  key={src.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-uk-navy">
                      {src.original_name}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                      {examLabel(src.exam)} · {formatBytes(src.size_bytes)} ·{" "}
                      {src.item_count} item{src.item_count === 1 ? "" : "s"} ·{" "}
                      {formatWhen(src.created_at)}
                    </p>
                    <p className="mt-1 text-[11px] capitalize text-uk-navy/70">
                      {src.features.join(" · ") || "—"}
                    </p>
                    {src.size_bytes === 0 && (
                      <p className="mt-1 text-[11px] text-amber-700">
                        Original file not retained — you can still delete the
                        generated content.
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={src.size_bytes === 0}
                      title={
                        src.size_bytes === 0
                          ? "Original PDF was not saved for this legacy upload"
                          : "Preview PDF"
                      }
                      onClick={() => setPreview(src)}
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-[var(--color-destructive)]/30 text-[var(--color-destructive)] hover:bg-red-50"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        const ok = window.confirm(
                          `Delete "${src.original_name}" and the ${src.item_count} generated item(s)?`
                        );
                        if (ok) deleteMutation.mutate(src.id);
                      }}
                    >
                      {deleteMutation.isPending &&
                      deleteMutation.variables === src.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {deleteMutation.isError && (
            <p className="mt-3 text-sm text-[var(--color-destructive)]">
              {getApiErrorMessage(
                deleteMutation.error,
                "Could not delete this source PDF."
              )}
            </p>
          )}
        </CardContent>
      </Card>

      {preview && (
        <GenerationPdfPreview
          sourceId={preview.id}
          title={preview.original_name}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
