"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ChatFeed from "@/components/ChatFeed";
import ChatThreadReply from "@/components/ChatThreadReply";
import type { ChatMessage, ChatThread } from "@/lib/coach-chat";
import { DEMO_COACH } from "@/lib/demo-coach";

function orderThreads(threads: ChatThread[]) {
  const direct = threads.filter((t) => t.kind === "member");
  const cohorts = threads.filter((t) => t.kind !== "member");
  return [...direct, ...cohorts];
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
  const defaultDirect = orderedInitial.find((t) => t.kind === "member");

  const [threads, setThreads] = useState(orderedInitial);
  const [activeId, setActiveId] = useState(defaultDirect?.id || orderedInitial[0]?.id || "");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const orderedThreads = useMemo(() => orderThreads(threads), [threads]);
  const activeThread = threads.find((t) => t.id === activeId) || null;
  const feedThread = displayThread(activeThread);

  const loadMessages = useCallback(
    async (threadId: string, opts?: { quiet?: boolean }) => {
      if (!threadId) return;
      if (!opts?.quiet) setLoading(true);
      try {
        const res = await fetch(
          `/api/chat/messages?threadId=${encodeURIComponent(threadId)}&role=member`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = await res.json();
        const next: ChatMessage[] = data.messages || [];
        setMessages((prev) => {
          if (prev.length !== next.length) return next;
          return prev.every(
            (m, i) =>
              m.id === next[i]?.id &&
              JSON.stringify(m.reactions ?? []) === JSON.stringify(next[i]?.reactions ?? []),
          )
            ? prev
            : next;
        });
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
    if (activeId) loadMessages(activeId);
  }, [activeId, loadMessages]);

  useEffect(() => {
    if (!activeId) return;
    const id = setInterval(() => loadMessages(activeId, { quiet: true }), 4000);
    return () => clearInterval(id);
  }, [activeId, loadMessages]);

  const directThread = threads.find((t) => t.kind === "member");
  const replyThreadId = directThread?.id || activeId;

  function appendMessage(message?: ChatMessage) {
    if (!message || message.threadId !== activeId) return;
    setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
  }

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
        {loading && (
          <p className="shrink-0 border-b border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)]">Loading...</p>
        )}
        <ChatFeed
          thread={feedThread}
          messages={messages}
          viewerRole="member"
          viewerId={memberId}
          emptyLabel="No posts from your coach yet."
          onReactionChange={(updated) =>
            setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
          }
        />
        {replyThreadId && (
          <ChatThreadReply
            threadId={replyThreadId}
            role="member"
            onSent={(message) => {
              appendMessage(message);
              if (activeId) void loadMessages(activeId);
              if (replyThreadId !== activeId) void loadMessages(replyThreadId);
            }}
          />
        )}
      </div>
    </div>
  );
}