import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Eye,
  FileText,
  FolderOpen,
  GraduationCap,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteDocument, reprocessDocument, updateDocument } from "@/services/documents";
import type { Document, DocumentStatus } from "@/types/document";

function StatusBadge({ status, chunkCount }: { status: DocumentStatus; chunkCount: number }) {
  if (status === "ready") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600">
        <CheckCircle2 className="h-3 w-3" /> Ready · {chunkCount} chunks
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[var(--color-destructive)]">
        <AlertCircle className="h-3 w-3" /> Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
      <Loader2 className="h-3 w-3 animate-spin" />
      {status === "processing" ? "Processing…" : "Queued…"}
    </span>
  );
}

interface DocumentListProps {
  documents: Document[];
  onPreview: (doc: Document) => void;
  onSummarize: (doc: Document) => void;
  onQuiz: (doc: Document) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function groupBySubject(documents: Document[]): [string, Document[]][] {
  const groups = new Map<string, Document[]>();
  for (const doc of documents) {
    const list = groups.get(doc.subject) ?? [];
    list.push(doc);
    groups.set(doc.subject, list);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function DocumentRow({
  doc,
  onPreview,
  onSummarize,
  onQuiz,
}: {
  doc: Document;
  onPreview: (doc: Document) => void;
  onSummarize: (doc: Document) => void;
  onQuiz: (doc: Document) => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(doc.original_name);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["documents"] });

  const renameMutation = useMutation({
    mutationFn: () => updateDocument(doc.id, { original_name: name.trim() }),
    onSuccess: () => {
      invalidate();
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDocument(doc.id),
    onSuccess: invalidate,
  });

  const reprocessMutation = useMutation({
    mutationFn: () => reprocessDocument(doc.id),
    onSuccess: invalidate,
  });

  const busy =
    renameMutation.isPending ||
    deleteMutation.isPending ||
    reprocessMutation.isPending;

  return (
    <li className="flex items-center justify-between gap-2 rounded-md border border-[var(--color-border)] px-3 py-2">
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
        {editing ? (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) renameMutation.mutate();
              if (e.key === "Escape") {
                setName(doc.original_name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">
              {doc.original_name}.pdf
            </span>
            <span className="flex flex-wrap items-center gap-x-2 text-xs text-[var(--color-muted-foreground)]">
              <span>{formatBytes(doc.size_bytes)}</span>
              <span>·</span>
              <StatusBadge status={doc.status} chunkCount={doc.chunk_count} />
            </span>
            {doc.status === "failed" && doc.error && (
              <span className="mt-0.5 block truncate text-xs text-[var(--color-destructive)]">
                {doc.error}
              </span>
            )}
          </span>
        )}
      </span>

      <span className="flex shrink-0 items-center gap-1">
        {editing ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              disabled={!name.trim() || renameMutation.isPending}
              onClick={() => renameMutation.mutate()}
              aria-label="Save name"
            >
              {renameMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setName(doc.original_name);
                setEditing(false);
              }}
              aria-label="Cancel rename"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            {doc.status === "failed" && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => reprocessMutation.mutate()}
                aria-label="Retry processing"
                title="Retry processing"
              >
                {reprocessMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={doc.status !== "ready"}
              onClick={() => onSummarize(doc)}
              aria-label="AI summary"
              title={
                doc.status === "ready"
                  ? "AI summary"
                  : "Available after processing finishes"
              }
            >
              <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={doc.status !== "ready"}
              onClick={() => onQuiz(doc)}
              aria-label="AI quiz"
              title={
                doc.status === "ready"
                  ? "AI quiz"
                  : "Available after processing finishes"
              }
            >
              <GraduationCap className="h-4 w-4 text-[var(--color-primary)]" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPreview(doc)}
              aria-label="Preview"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setEditing(true)}
              aria-label="Rename"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Delete "${doc.original_name}.pdf"?`)) {
                  deleteMutation.mutate();
                }
              }}
              aria-label="Delete"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 text-[var(--color-destructive)]" />
              )}
            </Button>
          </>
        )}
      </span>
    </li>
  );
}

export default function DocumentList({
  documents,
  onPreview,
  onSummarize,
  onQuiz,
}: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
        No PDFs yet. Upload some to get started.
      </p>
    );
  }

  const groups = groupBySubject(documents);

  return (
    <div className="space-y-6">
      {groups.map(([subject, docs]) => (
        <div key={subject}>
          <div className="mb-2 flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-[var(--color-muted-foreground)]" />
            <h3 className="text-sm font-semibold">{subject}</h3>
            <span className="text-xs text-[var(--color-muted-foreground)]">
              ({docs.length})
            </span>
          </div>
          <ul className="space-y-2">
            {docs.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                onPreview={onPreview}
                onSummarize={onSummarize}
                onQuiz={onQuiz}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
