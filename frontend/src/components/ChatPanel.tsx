import { useRef, useState } from "react";
import { FileText, Loader2, Send, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { streamChatQuery } from "@/services/chat";
import type { SourceChunk } from "@/types/chat";

interface ChatPanelProps {
  /** How many documents are READY to be queried. */
  readyCount: number;
}

export default function ChatPanel({ readyCount }: ChatPanelProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<SourceChunk[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asked, setAsked] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const canAsk = readyCount > 0 && question.trim().length > 0 && !streaming;

  const submit = async () => {
    if (!canAsk) return;
    const q = question.trim();
    setAsked(q);
    setQuestion("");
    setAnswer("");
    setSources([]);
    setError(null);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    await streamChatQuery(
      { question: q },
      {
        signal: controller.signal,
        onSources: setSources,
        onToken: (text) => setAnswer((prev) => prev + text),
        onDone: () => setStreaming(false),
        onError: (message) => {
          setError(message);
          setStreaming(false);
        },
      }
    ).catch((err) => {
      // Aborts are expected when the user clicks Stop.
      if (err?.name !== "AbortError") {
        setError("Something went wrong while answering.");
      }
      setStreaming(false);
    });
  };

  const stop = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <textarea
          className="min-h-[44px] flex-1 resize-none rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          rows={2}
          placeholder={
            readyCount > 0
              ? "Ask a question about your PDFs…"
              : "Upload and process a PDF first to start asking questions."
          }
          value={question}
          disabled={readyCount === 0}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {streaming ? (
          <Button variant="outline" onClick={stop} aria-label="Stop">
            <Square className="h-4 w-4" />
            Stop
          </Button>
        ) : (
          <Button onClick={submit} disabled={!canAsk} aria-label="Send">
            <Send className="h-4 w-4" />
            Ask
          </Button>
        )}
      </div>

      {(asked || answer || streaming || error) && (
        <div className="rounded-lg border border-[var(--color-border)] p-4">
          {asked && (
            <p className="mb-2 text-sm font-medium text-[var(--color-muted-foreground)]">
              {asked}
            </p>
          )}

          {error ? (
            <p className="text-sm text-[var(--color-destructive)]">{error}</p>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {answer}
              {streaming && (
                <Loader2 className="ml-1 inline h-3 w-3 animate-spin align-middle" />
              )}
            </p>
          )}

          {sources.length > 0 && (
            <div className="mt-4 border-t border-[var(--color-border)] pt-3">
              <p className="mb-2 text-xs font-semibold text-[var(--color-muted-foreground)]">
                Sources
              </p>
              <ul className="space-y-2">
                {sources.map((s) => (
                  <li
                    key={`${s.document_id}-${s.chunk_index}`}
                    className="rounded-md bg-slate-50 p-2 text-xs"
                  >
                    <span className="flex items-center gap-1 font-medium">
                      <FileText className="h-3 w-3 text-[var(--color-primary)]" />
                      {s.document_name}.pdf
                      <span className="font-normal text-[var(--color-muted-foreground)]">
                        · {s.subject} · match {(s.score * 100).toFixed(0)}%
                      </span>
                    </span>
                    <span className="mt-1 block text-[var(--color-muted-foreground)]">
                      {s.preview}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
