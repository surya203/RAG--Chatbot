import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api";
import { uploadDocuments } from "@/services/documents";

interface UploadPanelProps {
  /** Existing subjects, offered as autocomplete suggestions. */
  subjects: string[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadPanel({ subjects }: UploadPanelProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [subject, setSubject] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      uploadDocuments(files, subject.trim() || "Unsorted", setProgress),
    onMutate: () => {
      setError(null);
      setNotice(null);
      setProgress(0);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setFiles([]);
      if (inputRef.current) inputRef.current.value = "";
      const ok = data.uploaded.length;
      setNotice(`${ok} file${ok === 1 ? "" : "s"} uploaded.`);
      if (data.errors.length > 0) {
        setError(data.errors.join("  •  "));
      }
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, "Upload failed. Please try again."));
    },
  });

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const pdfs = Array.from(incoming).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    setFiles((prev) => [...prev, ...pdfs]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          list="subject-suggestions"
          placeholder="e.g. Biology (leave blank for Unsorted)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={mutation.isPending}
        />
        <datalist id="subject-suggestions">
          {subjects.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>

      <div
        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--color-border)] p-6 text-center transition-colors hover:bg-[var(--color-accent)]"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
      >
        <Upload className="mb-2 h-6 w-6 text-[var(--color-muted-foreground)]" />
        <p className="text-sm font-medium">Click to choose PDFs or drag them here</p>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Multiple files supported • PDF only
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                <span className="truncate">{file.name}</span>
                <span className="shrink-0 text-xs text-[var(--color-muted-foreground)]">
                  {formatBytes(file.size)}
                </span>
              </span>
              {!mutation.isPending && (
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)]"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {mutation.isPending && (
        <div className="space-y-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-[var(--color-primary)] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Uploading... {progress}%
          </p>
        </div>
      )}

      {notice && <p className="text-sm text-green-600">{notice}</p>}
      {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}

      <Button
        className="w-full"
        disabled={files.length === 0 || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading...
          </>
        ) : (
          `Upload ${files.length > 0 ? `(${files.length})` : ""}`
        )}
      </Button>
    </div>
  );
}
