import { ensureFreshAccessToken, getStoredAccessToken } from "@/lib/api";
import type { ChatQueryRequest, SourceChunk } from "@/types/chat";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "";

interface StreamHandlers {
  onMeta?: (meta: { conversation_id: string; title: string }) => void;
  onSources?: (sources: SourceChunk[]) => void;
  onToken?: (text: string) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
  signal?: AbortSignal;
}

function detailToMessage(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  return fallback;
}

/**
 * POST a question and consume the Server-Sent Events stream.
 *
 * EventSource can't send an Authorization header, so we use fetch + a manual
 * SSE parser over the response body's ReadableStream.
 */
export async function streamChatQuery(
  request: ChatQueryRequest,
  handlers: StreamHandlers
): Promise<void> {
  const doFetch = async (token: string | null) =>
    fetch(`${API_BASE_URL}/api/v1/chat/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(request),
      signal: handlers.signal,
    });

  let token = getStoredAccessToken();
  let response = await doFetch(token);

  // Retry once after refreshing if the access token expired.
  if (response.status === 401) {
    token = await ensureFreshAccessToken();
    if (!token) {
      handlers.onError?.("Session expired. Please sign in again.");
      return;
    }
    response = await doFetch(token);
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      message = detailToMessage(body?.detail, message);
    } catch {
      // keep default message
    }
    handlers.onError?.(message);
    return;
  }

  if (!response.body) {
    handlers.onError?.("No response stream.");
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;

  const handleEvent = (raw: string) => {
    // Each SSE event is one or more "data: ..." lines.
    const dataLines = raw
      .replace(/\r\n/g, "\n")
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim());
    if (dataLines.length === 0) return;

    const payload = dataLines.join("");
    let event: { type: string; [k: string]: unknown };
    try {
      event = JSON.parse(payload);
    } catch {
      return;
    }

    switch (event.type) {
      case "meta":
        handlers.onMeta?.({
          conversation_id: event.conversation_id as string,
          title: event.title as string,
        });
        break;
      case "sources":
        handlers.onSources?.((event.sources as SourceChunk[]) ?? []);
        break;
      case "token":
        handlers.onToken?.((event.text as string) ?? "");
        break;
      case "done":
        completed = true;
        handlers.onDone?.();
        break;
      case "error":
        completed = true;
        handlers.onError?.((event.message as string) ?? "Unknown error");
        break;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Events are separated by a blank line (tolerate \r\n framing).
    buffer = buffer.replace(/\r\n/g, "\n");
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      handleEvent(rawEvent);
    }
  }

  // Flush any trailing event without a terminating blank line.
  if (buffer.trim()) handleEvent(buffer);

  // Guarantee a terminal callback if the socket closed without done/error.
  if (!completed) {
    handlers.onDone?.();
  }
}
