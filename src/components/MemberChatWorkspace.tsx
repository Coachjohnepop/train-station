"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ChatFeed from "@/components/ChatFeed";
import ChatThreadReply from "@/components/ChatThreadReply";
import type { ChatMessage, ChatThread } from "@/lib/coach-chat";
import { applyChatMessageLoad } from "@/lib/chat-message-merge";
import { DEMO_COACH } from "@/lib/demo-coach";

function orderThreads(threads: ChatThread[]) {
  const cohorts = threads.filter((t) => t.kind === "cohort");
  const direct = threads.filter((t) => t.kind === "member");
  return [...cohorts, ...direct];
}

function threadLabel(thread: ChatThread) {
  if (thread.kind === "cohort") return `${thread.title} · Community`;
  return DEMO_COACH.displayName;
}

function displayThread(thread: ChatThread | null): ChatThread | null {
  if (!thread) return null;
  if (thread.kind === "member") {
    return { ...thread, title: DEMO_COACH.displayName };
  }
  return thread;
}

export default function MemberChatWorkspace({
  initialThreads,
  memberId,
}: {
  initialThreads: ChatThread[];
  memberId: string;
}) {
  const orderedInitial = useMemo(() => orderThreads(initialThreads), [initialThreads]);
  const defaultCommunity = orderedInitial.find((t) => t.kind === "cohort");
  const defaultDirect = orderedInitial.find((t) => t.kind === "member");

  const [threads, setThreads] = useState(orderedInitial);
  const [activeId, setActiveId] = useState(
    defaultCommunity?.id || defaultDirect?.id || orderedInitial[0]?.id || "",
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const orderedThreads = useMemo(() => orderThreads(threads), [threads]);
  const activeThread = threads.find((t) => t.id === activeId) || null;
  const feedThread = displayThread(activeThread);
  const visibleMessages = useMemo(
    () => messages.filter((m) => m.threadId === activeId),
    [messages, activeId],
  );

  const loadMessages = useCallback(
    async (threadId: string, opts?: { quiet?: boolean; replace?: boolean }) => {
      if (!threadId) return;
      if (!opts?.quiet) setLoading(true);
      try {
        const res = await fetch(
          `/api/chat/messages?threadId=${encodeURIComponent(threadId)}&role=member`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = await res.json();
        const incoming: ChatMessage[] = data.messages || [];
        setMessages((prev) => applyChatMessageLoad(prev, incoming, { replace: opts?.replace }));
        window.dispatchEvent(new CustomEvent("chat-unread-refresh"));
      } finally {
        if (!opts?.quiet) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    setThreads(orderThreads(initialThreads));
  }, [initialThreads]);

  useEffect(() => {
    if (!activeId) return;
    void loadMessages(activeId, { replace: true });
  }, [activeId, loadMessages]);

  useEffect(() => {
    if (!activeId) return;
    const id = setInterval(() => loadMessages(activeId, { quiet: true }), 5000);
    return () => clearInterval(id);
  }, [activeId, loadMessages]);

  const activeReplyThread = threads.find((t) => t.id === activeId);
  const replyThreadId = activeId;
  const replyPlaceholder =
    activeReplyThread?.kind === "cohort"
      ? "Comment on this post..."
      : "Message your coach...";

  return (
    <div className="space-y-4">
      {orderedThreads.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {orderedThreads.map((t) => (
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
              {threadLabel(t)}
            </button>
          ))}
        </div>
      )}

      <div className="flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        {loading && visibleMessages.length === 0 && (
          <p className="shrink-0 border-b border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)]">Loading...</p>
        )}
        <ChatFeed
          thread={feedThread}
          messages={visibleMessages}
          viewerRole="member"
          viewerId={memberId}
          emptyLabel={
            activeReplyThread?.kind === "cohort"
              ? "No community posts yet."
              : "No messages from your coach yet."
          }
          onReactionChange={(updated) =>
            setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
          }
        />
        {replyThreadId && (
          <ChatThreadReply
            threadId={replyThreadId}
            role="member"
            threadKind={activeReplyThread?.kind}
            placeholder={replyPlaceholder}
            onSent={(message) => {
              if (!message) return;
              setMessages((prev) => {
                if (prev.some((m) => m.id === message.id)) return prev;
                return [...prev, message].sort(
                  (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
                );
              });
            }}
          />
        )}
      </div>
    </div>
  );
}