import type { SourceChunk } from "@/types/chat";

export interface Conversation {
  id: string;
  title: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  sources: SourceChunk[] | null;
  created_at: string;
}

export interface ConversationDetail extends Conversation {
  messages: Message[];
}
