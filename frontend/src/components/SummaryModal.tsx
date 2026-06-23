import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, RefreshCw, Sparkles, X } from "lucide-react";

import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api";
import { generateSummary, getSummary, listSummaryTypes } from "@/services/summaries";
import type { Document } from "@/types/document";

interface SummaryModalProps {
  document: Document;
  onClose: () => void;
}

export default function SummaryModal({ document, onClose }: SummaryModalProps) {
  const queryClient = useQueryClient();
  const [activeType, setActiveType] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: types } = useQuery({
    queryKey: ["summaries", document.id],
    queryFn: () => listSummaryTypes(document.id),
  });

  // Default to the first tab once the type list loads.
  const currentType = activeType ?? types?.[0]?.key ?? null;
  const currentInfo = types?.find((t) => t.key === currentType);

  const { data: summary, isFetching } = useQuery({
    queryKey: ["summary", document.id, currentType],
    queryFn: () => getSummary(document.id, currentType as string),
    enabled: !!currentType && !!currentInfo?.generated,
  });

  const generateMutation = useMutation({
    mutationFn: () => generateSummary(document.id, currentType as string),
    onMutate: () => setError(null),
    onSuccess: (data) => {
      queryClient.setQueryData(["summary", document.id, currentType], data);
      queryClient.invalidateQueries({ queryKey: ["summaries", document.id] });
    },
    onError: (err) =>
      setError(getApiErrorMessage(err, "Could not generate this summary.")),
  });

  const copy = async () => {
    if (!summary?.content) return;
    await navigator.clipboard.writeText(summary.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const selectTab = (key: string) => {
    setActiveType(key);
    setError(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="flex items-center gap-2 truncate text-sm font-medium">
            <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
            AI Summary · {document.original_name}.pdf
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 border-b border-[var(--color-border)] px-3 py-2">
          {types?.map((t) => (
            <button
              key={t.key}
              onClick={() => selectTab(t.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                t.key === currentType
                  ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                  : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]"
              }`}
            >
              {t.label}
              {t.generated && <span className="ml-1 opacity-70">•</span>}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {!currentType ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">Loading…</p>
          ) : generateMutation.isPending ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-[var(--color-muted-foreground)]">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Generating {currentInfo?.label}…</span>
            </div>
          ) : error ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--color-destructive)]">{error}</p>
              <Button size="sm" onClick={() => generateMutation.mutate()}>
                <RefreshCw className="h-4 w-4" />
                Try again
              </Button>
            </div>
          ) : currentInfo?.generated ? (
            isFetching && !summary ? (
              <div className="flex items-center gap-2 py-8 text-[var(--color-muted-foreground)]">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading…</span>
              </div>
            ) : (
              summary && <Markdown content={summary.content} />
            )
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Sparkles className="h-8 w-8 text-[var(--color-primary)]" />
              <p className="text-sm text-[var(--color-muted-foreground)]">
                Generate a <strong>{currentInfo?.label}</strong> from this document.
              </p>
              <Button onClick={() => generateMutation.mutate()}>
                <Sparkles className="h-4 w-4" />
                Generate
              </Button>
            </div>
          )}
        </div>

        {/* Footer actions when a summary is shown */}
        {currentInfo?.generated && summary && !generateMutation.isPending && (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-4 py-2">
            <Button variant="ghost" size="sm" onClick={copy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateMutation.mutate()}
            >
              <RefreshCw className="h-4 w-4" />
              Regenerate
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
