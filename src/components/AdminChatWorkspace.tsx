"use client";

import { useCallback, useEffect, useState } from "react";
import ChatFeed from "@/components/ChatFeed";
import type { ChatMessage, ChatThread } from "@/lib/coach-chat";

export default function AdminChatWorkspace({ initialThreads }: { initialThreads: ChatThread[] }) {
  const [threads, setThreads] = useState(initialThreads);
  const [activeId, setActiveId] = useState(initialThreads[0]?.id || "");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const activeThread = threads.find((t) => t.id === activeId) || null;

  const loadMessages = useCallback(async (threadId: string) => {
    if (!threadId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/messages?threadId=${encodeURIComponent(threadId)}&role=coach`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
  }, [activeId, loadMessages]);

  useEffect(() => {
    function onPosted() {
      refreshThreads();
      if (activeId) loadMessages(activeId);
    }
    window.addEventListener("coach-chat-posted", onPosted);
    return () => window.removeEventListener("coach-chat-posted", onPosted);
  }, [activeId, loadMessages]);

  async function refreshThreads() {
    const res = await fetch("/api/chat/threads?role=coach");
    if (!res.ok) return;
    const data = await res.json();
    setThreads(data.threads || []);
    if (!activeId && data.threads?.[0]) setActiveId(data.threads[0].id);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <aside className="card space-y-1 p-2">
        <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Threads</p>
        {threads.length === 0 ? (
          <p className="px-2 text-xs text-[var(--muted)]">Post an update to start.</p>
        ) : (
          threads.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveId(t.id)}
              className={`w-full rounded-lg px-2 py-2 text-left text-sm transition ${
                t.id === activeId ? "bg-accent/20 text-accent" : "hover:bg-[var(--surface-2)]"
              }`}
            >
              <span className="font-medium block truncate">{t.title}</span>
              <span className="text-[10px] text-[var(--muted)]">
                {t.kind === "cohort" ? "Cohort" : "Member"}
              </span>
            </button>
          ))
        )}
        <button type="button" onClick={refreshThreads} className="mt-2 w-full text-xs text-accent hover:underline">
          Refresh
        </button>
      </aside>

      <div>
        {loading && <p className="mb-2 text-xs text-[var(--muted)]">Loading...</p>}
        <ChatFeed
          thread={activeThread}
          messages={messages}
          viewerRole="coach"
          emptyLabel="No messages in this thread yet."
        />
      </div>
    </div>
  );
}