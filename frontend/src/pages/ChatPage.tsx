import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Loader2,
  Mic,
  Pause,
  Play,
  Send,
  Square,
  Volume2,
} from "lucide-react";

import ConversationSidebar from "@/components/ConversationSidebar";
import ChatPdfScope from "@/components/ChatPdfScope";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { streamChatQuery } from "@/services/chat";
import { getConversation } from "@/services/conversations";
import { listDocuments } from "@/services/documents";
import type { SourceChunk } from "@/types/chat";
import type { Message } from "@/types/conversation";

const STREAM_ID = "__streaming__";

export default function ChatPage() {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const tts = useSpeechSynthesis();
  const stt = useSpeechRecognition({
    onTranscript: (text) => setInput(text),
  });

  const { data: detail } = useQuery({
    queryKey: ["conversation", activeId],
    queryFn: () => getConversation(activeId as string),
    enabled: !!activeId,
  });

  const { data: documents } = useQuery({
    queryKey: ["documents"],
    queryFn: listDocuments,
  });

  const selectedPdfNames = selectedDocIds
    .map((id) => documents?.find((d) => d.id === id)?.original_name)
    .filter((name): name is string => Boolean(name));

  // Load server messages into view when the selected conversation changes —
  // but never clobber an in-progress stream.
  useEffect(() => {
    if (streaming) return;
    if (!activeId) {
      setMessages([]);
    } else if (detail) {
      setMessages(detail.messages);
    }
  }, [activeId, detail, streaming]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const updateStreamingMessage = (fn: (m: Message) => Message) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === STREAM_ID ? fn(m) : m))
    );
  };

  const send = async () => {
    const q = input.trim();
    if (!q || streaming) return;
    if (stt.listening) stt.stop();
    tts.stop();
    setInput("");
    setError(null);
    setStreaming(true);

    const now = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      { id: "user-" + now, role: "user", content: q, sources: null, created_at: now },
      { id: STREAM_ID, role: "assistant", content: "", sources: null, created_at: now },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;
    let newConversationId: string | null = null;

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      setStreaming(false);
    };

    try {
      await streamChatQuery(
        {
          question: q,
          conversation_id: activeId ?? undefined,
          document_ids:
            selectedDocIds.length > 0 ? selectedDocIds : undefined,
        },
        {
          signal: controller.signal,
          onMeta: ({ conversation_id }) => {
            newConversationId = conversation_id;
            if (!activeId) setActiveId(conversation_id);
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
          },
          onSources: (sources: SourceChunk[]) =>
            updateStreamingMessage((m) => ({ ...m, sources })),
          onToken: (text) =>
            updateStreamingMessage((m) => ({ ...m, content: m.content + text })),
          onDone: () => {
            finish();
            const id = newConversationId ?? activeId;
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
            if (id) queryClient.invalidateQueries({ queryKey: ["conversation", id] });
          },
          onError: (message) => {
            setError(message);
            finish();
            // Drop the empty streaming placeholder on hard errors.
            setMessages((prev) => prev.filter((m) => m.id !== STREAM_ID || m.content));
          },
        }
      );
    } catch (err) {
      const name = err && typeof err === "object" && "name" in err ? String(err.name) : "";
      if (name !== "AbortError") setError("Something went wrong.");
    } finally {
      finish();
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  return (
    <div className="flex h-full min-h-0 bg-slate-100">
      <ConversationSidebar activeId={activeId} onSelect={(id) => setActiveId(id)} />

      <ChatPdfScope selectedIds={selectedDocIds} onChange={setSelectedDocIds} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white shadow-sm">
        <header className="border-b border-[var(--color-border)] px-4 py-2.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="truncate text-sm font-semibold text-uk-navy sm:text-base">
              {detail?.title ?? "New chat"}
            </h1>
            {selectedPdfNames.length > 0 && (
              <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                {selectedPdfNames.map((name) => (
                  <span
                    key={name}
                    className="inline-flex max-w-[180px] items-center gap-1 rounded-full border border-uk-red/20 bg-uk-red/5 px-2 py-0.5 text-[10px] font-medium text-uk-navy sm:max-w-[240px]"
                    title={name}
                  >
                    <FileText className="h-3 w-3 shrink-0 text-uk-red" />
                    <span className="truncate">{name}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          {selectedPdfNames.length === 0 && (
            <p className="mt-0.5 text-[11px] text-[var(--color-muted-foreground)]">
              Upload a PDF in the sidebar to chat with your materials.
            </p>
          )}
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-none space-y-5 xl:max-w-5xl">
            {messages.length === 0 ? (
              <div className="py-16 text-center text-sm text-[var(--color-muted-foreground)]">
                Ask a question about your PDFs to start a new conversation.
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--color-muted-foreground)]">
                      {m.role === "user" ? "You" : "Assistant"}
                    </span>
                    {m.role === "assistant" && m.content && tts.supported && (
                      <span className="flex items-center gap-1">
                        {tts.speakingId === m.id ? (
                          <>
                            {tts.paused ? (
                              <button
                                onClick={tts.resume}
                                className="text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)]"
                                title="Resume"
                                aria-label="Resume speaking"
                              >
                                <Play className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={tts.pause}
                                className="text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)]"
                                title="Pause"
                                aria-label="Pause speaking"
                              >
                                <Pause className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              onClick={tts.stop}
                              className="text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)]"
                              title="Stop"
                              aria-label="Stop speaking"
                            >
                              <Square className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => tts.speak(m.id, m.content)}
                            className="text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)]"
                            title="Read aloud"
                            aria-label="Read aloud"
                          >
                            <Volume2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                  {m.role === "user" ? (
                    <p className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm leading-relaxed">
                      {m.content}
                    </p>
                  ) : (
                    <div className="rounded-lg border border-[var(--color-border)] bg-white p-4 shadow-sm">
                      {m.content ? (
                        <Markdown content={m.content} />
                      ) : (
                        streaming && (
                          <Loader2 className="h-4 w-4 animate-spin text-[var(--color-muted-foreground)]" />
                        )
                      )}
                      {m.sources && m.sources.length > 0 && (
                        <div className="mt-3 border-t border-[var(--color-border)] pt-2">
                          <p className="mb-1 text-xs font-semibold text-[var(--color-muted-foreground)]">
                            Sources
                          </p>
                          <ul className="space-y-1">
                            {m.sources.map((s, i) => (
                              <li
                                key={`${s.document_id}-${s.chunk_index}-${i}`}
                                className="flex items-center gap-1 text-xs text-[var(--color-muted-foreground)]"
                              >
                                <FileText className="h-3 w-3 text-[var(--color-primary)]" />
                                {s.document_name}.pdf · {s.subject} ·{" "}
                                {(s.score * 100).toFixed(0)}%
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
            {error && (
              <p className="text-sm text-[var(--color-destructive)]">{error}</p>
            )}
          </div>
        </div>

        <div className="border-t border-[var(--color-border)] bg-white px-4 py-3 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-none gap-2 xl:max-w-5xl">
            {stt.supported && (
              <Button
                variant={stt.listening ? "default" : "outline"}
                size="sm"
                onClick={() => (stt.listening ? stt.stop() : stt.start())}
                title={
                  stt.secureContext
                    ? stt.listening
                      ? "Stop listening"
                      : "Ask with your voice"
                    : "Voice input needs http://localhost:5173"
                }
                aria-label="Voice input"
                className={stt.listening ? "animate-pulse" : ""}
              >
                <Mic className="h-4 w-4" />
              </Button>
            )}
            <textarea
              className="min-h-[44px] flex-1 resize-none rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
              rows={1}
              placeholder={
                stt.listening ? "Listening…" : "Ask a question about your PDFs…"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            {streaming ? (
              <Button variant="outline" onClick={stop}>
                <Square className="h-4 w-4" />
                Stop
              </Button>
            ) : (
              <Button onClick={send} disabled={!input.trim()}>
                <Send className="h-4 w-4" />
                Ask
              </Button>
            )}
          </div>
          {stt.error && (
            <p className="mx-auto mt-2 w-full max-w-none text-xs text-[var(--color-destructive)] xl:max-w-5xl">
              {stt.error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
