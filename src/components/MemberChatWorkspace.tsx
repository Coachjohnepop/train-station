"use client";

import { useCallback, useEffect, useState } from "react";
import ChatFeed from "@/components/ChatFeed";
import ChatThreadReply from "@/components/ChatThreadReply";
import type { ChatMessage, ChatThread } from "@/lib/coach-chat";

export default function MemberChatWorkspace({ initialThreads }: { initialThreads: ChatThread[] }) {
  const [threads, setThreads] = useState(initialThreads);
  const [activeId, setActiveId] = useState(initialThreads[0]?.id || "");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const activeThread = threads.find((t) => t.id === activeId) || null;

  const loadMessages = useCallback(
    async (threadId: string, opts?: { quiet?: boolean }) => {
      if (!threadId) return;
      if (!opts?.quiet) setLoading(true);
      try {
        const res = await fetch(
          `/api/chat/messages?threadId=${encodeURIComponent(threadId)}&role=member`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = await res.json();
        const next: ChatMessage[] = data.messages || [];
        setMessages((prev) =>
          prev.length === next.length && prev[prev.length - 1]?.id === next[next.length - 1]?.id
            ? prev
            : next
        );
        window.dispatchEvent(new CustomEvent("chat-unread-refresh"));
      } finally {
        if (!opts?.quiet) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (activeId) loadMessages(activeId);
  }, [activeId, loadMessages]);

  // Poll for new messages so incoming coach replies appear live.
  useEffect(() => {
    if (!activeId) return;
    const id = setInterval(() => loadMessages(activeId, { quiet: true }), 6000);
    return () => clearInterval(id);
  }, [activeId, loadMessages]);

  const directThread = threads.find((t) => t.kind === "member");
  const replyThreadId = directThread?.id || activeId;

  return (
    <div className="space-y-4">
      {threads.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {threads.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveId(t.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                t.id === activeId
                  ? "bg-accent/20 text-accent ring-1 ring-accent/50"
                  : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {t.kind === "cohort" ? `${t.title} · Community` : t.title}
            </button>
          ))}
        </div>
      )}

      <div className="flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        {loading && (
          <p className="shrink-0 border-b border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)]">Loading...</p>
        )}
        <ChatFeed
          thread={activeThread}
          messages={messages}
          viewerRole="member"
          emptyLabel="No posts from your coach yet."
        />
        {replyThreadId && (
          <ChatThreadReply
            threadId={replyThreadId}
            role="member"
            onSent={() => {
              if (activeId) loadMessages(activeId);
              if (replyThreadId !== activeId) loadMessages(replyThreadId);
            }}
          />
        )}
      </div>
    </div>
  );
}