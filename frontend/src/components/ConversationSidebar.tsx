import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  MessageSquarePlus,
  Pin,
  PinOff,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteConversation,
  listConversations,
  renameConversation,
  setConversationPinned,
} from "@/services/conversations";
import type { Conversation } from "@/types/conversation";

interface ConversationSidebarProps {
  activeId: string | null;
  onSelect: (id: string | null) => void;
}

export default function ConversationSidebar({
  activeId,
  onSelect,
}: ConversationSidebarProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const { data: conversations } = useQuery({
    queryKey: ["conversations", search],
    queryFn: () => listConversations(search.trim() || undefined),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["conversations"] });

  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      renameConversation(id, title),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
  });

  const pinMutation = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      setConversationPinned(id, pinned),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteConversation(id),
    onSuccess: (_data, id) => {
      invalidate();
      if (id === activeId) onSelect(null);
    },
  });

  const startRename = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-[var(--color-border)] bg-white">
      <div className="space-y-2 p-3">
        <Button className="w-full" onClick={() => onSelect(null)}>
          <MessageSquarePlus className="h-4 w-4" />
          New chat
        </Button>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
          <Input
            className="pl-8"
            placeholder="Search chats"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {!conversations || conversations.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-[var(--color-muted-foreground)]">
            {search ? "No matching chats." : "No chats yet."}
          </p>
        ) : (
          <ul className="space-y-1">
            {conversations.map((conv) => {
              const isActive = conv.id === activeId;
              const isEditing = conv.id === editingId;
              return (
                <li key={conv.id}>
                  <div
                    className={`group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm ${
                      isActive ? "bg-[var(--color-accent)]" : "hover:bg-slate-50"
                    }`}
                  >
                    {isEditing ? (
                      <>
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="h-7"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && editTitle.trim())
                              renameMutation.mutate({ id: conv.id, title: editTitle.trim() });
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <button
                          className="text-[var(--color-muted-foreground)] hover:text-foreground"
                          onClick={() =>
                            editTitle.trim() &&
                            renameMutation.mutate({ id: conv.id, title: editTitle.trim() })
                          }
                          aria-label="Save title"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          className="text-[var(--color-muted-foreground)] hover:text-foreground"
                          onClick={() => setEditingId(null)}
                          aria-label="Cancel"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="flex min-w-0 flex-1 items-center gap-1 text-left"
                          onClick={() => onSelect(conv.id)}
                          onDoubleClick={() => startRename(conv)}
                          title={conv.title}
                        >
                          {conv.is_pinned && (
                            <Pin className="h-3 w-3 shrink-0 text-[var(--color-primary)]" />
                          )}
                          <span className="truncate">{conv.title}</span>
                        </button>
                        <span className="hidden shrink-0 items-center gap-1 group-hover:flex">
                          <button
                            className="text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)]"
                            onClick={() =>
                              pinMutation.mutate({ id: conv.id, pinned: !conv.is_pinned })
                            }
                            aria-label={conv.is_pinned ? "Unpin" : "Pin"}
                            title={conv.is_pinned ? "Unpin" : "Pin"}
                          >
                            {conv.is_pinned ? (
                              <PinOff className="h-3.5 w-3.5" />
                            ) : (
                              <Pin className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            className="text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)]"
                            onClick={() => {
                              if (window.confirm(`Delete "${conv.title}"?`))
                                deleteMutation.mutate(conv.id);
                            }}
                            aria-label="Delete chat"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
