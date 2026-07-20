import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  Loader2,
  Upload,
} from "lucide-react";

import PdfPreviewModal from "@/components/PdfPreviewModal";
import UploadPanel from "@/components/UploadPanel";
import { listDocuments } from "@/services/documents";
import type { Document } from "@/types/document";

interface ChatPdfScopeProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusDot({ status }: { status: Document["status"] }) {
  if (status === "ready") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600">
        <CheckCircle2 className="h-3 w-3" /> Ready
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--color-destructive)]">
        <AlertCircle className="h-3 w-3" /> Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--color-muted-foreground)]">
      <Loader2 className="h-3 w-3 animate-spin" /> Processing
    </span>
  );
}

function PdfMiniCard({
  doc,
  selected,
  onToggle,
  onPreview,
}: {
  doc: Document;
  selected: boolean;
  onToggle: () => void;
  onPreview: () => void;
}) {
  const chatReady = doc.status === "ready";

  return (
    <li
      className={`rounded-md border px-2 py-1.5 transition-colors ${
        selected && chatReady
          ? "border-uk-red/40 bg-uk-red/5"
          : "border-[var(--color-border)] bg-white hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={selected}
          disabled={!chatReady}
          onChange={onToggle}
          className="shrink-0 rounded"
          title={chatReady ? "Include in chat search" : "Available after processing"}
        />
        <FileText className="h-3.5 w-3.5 shrink-0 text-uk-red" />
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[11px] font-medium leading-tight text-uk-navy"
            title={`${doc.original_name} · ${doc.subject} · ${formatBytes(doc.size_bytes)}`}
          >
            {doc.original_name}
          </p>
          <StatusDot status={doc.status} />
        </div>
        <button
          type="button"
          onClick={onPreview}
          className="shrink-0 rounded p-0.5 text-[var(--color-muted-foreground)] hover:bg-slate-100 hover:text-uk-navy"
          aria-label={`Preview ${doc.original_name}`}
          title="Preview PDF"
        >
          <Eye className="h-3 w-3" />
        </button>
      </div>
    </li>
  );
}

export default function ChatPdfScope({
  selectedIds,
  onChange,
}: ChatPdfScopeProps) {
  const didInit = useRef(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: listDocuments,
    refetchInterval: (query) => {
      const docs = query.state.data;
      const processing = docs?.some(
        (d) => d.status === "pending" || d.status === "processing"
      );
      return processing ? 2500 : false;
    },
  });

  const myDocs = useMemo(() => documents ?? [], [documents]);

  const readyDocs = useMemo(
    () => myDocs.filter((d) => d.status === "ready"),
    [myDocs]
  );

  const subjects = useMemo(
    () =>
      Array.from(new Set(myDocs.map((d) => d.subject).filter(Boolean))).sort(),
    [myDocs]
  );

  useEffect(() => {
    if (didInit.current || readyDocs.length === 0) return;
    didInit.current = true;
    onChange(readyDocs.map((d) => d.id));
  }, [readyDocs, onChange]);

  const handleUploaded = (uploaded: Document[]) => {
    const ids = uploaded.map((d) => d.id);
    onChange(Array.from(new Set([...selectedIds, ...ids])));
  };

  const toggleOne = (doc: Document) => {
    if (selectedIds.includes(doc.id)) {
      onChange(selectedIds.filter((id) => id !== doc.id));
    } else {
      onChange([...selectedIds, doc.id]);
    }
  };

  const allSelected =
    readyDocs.length > 0 && selectedIds.length === readyDocs.length;

  return (
    <>
      <aside className="hidden w-52 shrink-0 flex-col border-r border-[var(--color-border)] bg-slate-50/80 md:flex xl:w-56">
        <div className="border-b border-[var(--color-border)] bg-white px-3 py-2">
          <h2 className="text-xs font-semibold text-uk-navy">Your PDFs</h2>
          <p className="text-[10px] text-[var(--color-muted-foreground)]">
            Select PDFs for this chat
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-uk-navy" />
            </div>
          ) : myDocs.length === 0 ? (
            <p className="py-6 text-center text-xs text-[var(--color-muted-foreground)]">
              No PDFs yet. Upload one below to start chatting.
            </p>
          ) : (
            <div className="space-y-2">
              {readyDocs.length > 0 && (
                <label className="flex cursor-pointer items-center gap-1.5 rounded border border-[var(--color-border)] bg-white px-2 py-1.5 text-[10px] font-medium text-uk-navy">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() =>
                      onChange(allSelected ? [] : readyDocs.map((d) => d.id))
                    }
                    className="rounded"
                  />
                  All ({readyDocs.length})
                </label>
              )}
              <ul className="space-y-1">
                {myDocs.map((doc) => (
                  <PdfMiniCard
                    key={doc.id}
                    doc={doc}
                    selected={selectedIds.includes(doc.id)}
                    onToggle={() => toggleOne(doc)}
                    onPreview={() => setPreviewDoc(doc)}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="border-t border-[var(--color-border)] bg-white p-2">
          <button
            type="button"
            onClick={() => setUploadOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-md border border-[var(--color-border)] px-2 py-1.5 text-[11px] font-medium text-uk-navy hover:bg-slate-50"
          >
            <span className="inline-flex items-center gap-1.5">
              <Upload className="h-3 w-3 text-uk-red" />
              Upload PDF
            </span>
            {uploadOpen ? (
              <ChevronUp className="h-3 w-3 text-[var(--color-muted-foreground)]" />
            ) : (
              <ChevronDown className="h-3 w-3 text-[var(--color-muted-foreground)]" />
            )}
          </button>
          {uploadOpen && (
            <div className="mt-2">
              <UploadPanel
                subjects={subjects}
                defaultSubject="My notes"
                compact
                onUploaded={(uploaded) => {
                  handleUploaded(uploaded);
                  setUploadOpen(false);
                }}
              />
            </div>
          )}
        </div>
      </aside>

      {previewDoc && (
        <PdfPreviewModal
          document={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </>
  );
}
