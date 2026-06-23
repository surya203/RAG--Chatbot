import { api } from "@/lib/api";
import type { Conversation, ConversationDetail } from "@/types/conversation";

export async function listConversations(search?: string): Promise<Conversation[]> {
  const { data } = await api.get<Conversation[]>("/api/v1/conversations", {
    params: search ? { q: search } : undefined,
  });
  return data;
}

export async function getConversation(id: string): Promise<ConversationDetail> {
  const { data } = await api.get<ConversationDetail>(`/api/v1/conversations/${id}`);
  return data;
}

export async function renameConversation(
  id: string,
  title: string
): Promise<Conversation> {
  const { data } = await api.patch<Conversation>(`/api/v1/conversations/${id}`, {
    title,
  });
  return data;
}

export async function setConversationPinned(
  id: string,
  is_pinned: boolean
): Promise<Conversation> {
  const { data } = await api.patch<Conversation>(`/api/v1/conversations/${id}`, {
    is_pinned,
  });
  return data;
}

export async function deleteConversation(id: string): Promise<void> {
  await api.delete(`/api/v1/conversations/${id}`);
}
