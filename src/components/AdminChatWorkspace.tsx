"use client";

import { useCallback, useEffect, useState } from "react";
import ChatFeed from "@/components/ChatFeed";
import ChatThreadReply from "@/components/ChatThreadReply";
import type { ChatMessage, ChatThread } from "@/lib/coach-chat";

function threadPreview(messages: ChatMessage[]) {
  const last = messages[messages.length - 1];
  if (!last) return "No messages yet";
  const text = last.body || last.workoutTitle || (last.kind === "youtube" ? "Shared a video" : "Update");
  return text.length > 48 ? `${text.slice(0, 48)}…` : text;
}

export default function AdminChatWorkspace({ initialThreads }: { initialThreads: ChatThread[] }) {
  const [threads, setThreads] = useState(initialThreads);
  const [activeId, setActiveId] = useState(initialThreads[0]?.id || "");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  const activeThread = threads.find((t) => t.id === activeId) || null;

  const loadMessages = useCallback(async (threadId: string) => {
    if (!threadId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/messages?threadId=${encodeURIComponent(threadId)}&role=coach`);
      if (!res.ok) return;
      const data = await res.json();
      const msgs = data.messages || [];
      setMessages(msgs);
      setPreviews((prev) => ({ ...prev, [threadId]: threadPreview(msgs) }));
      window.dispatchEvent(new CustomEvent("chat-unread-refresh"));
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
    <div className="grid min-h-[560px] gap-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm lg:grid-cols-[minmax(220px,260px)_1fr]">
      <aside className="border-b border-[var(--border)] lg:border-b-0 lg:border-r">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Inbox</p>
          <p className="text-[11px] text-[var(--muted)]">Members & cohort feeds</p>
        </div>
        <div className="max-h-[480px] overflow-y-auto p-2">
          {threads.length === 0 ? (
            <p className="px-2 py-4 text-xs text-[var(--muted)]">Post an update to start a thread.</p>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveId(t.id)}
                className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left transition ${
                  t.id === activeId ? "bg-accent/15 ring-1 ring-accent/40" : "hover:bg-[var(--surface-2)]"
                }`}
              >
                <span className="block truncate font-medium text-sm">{t.title}</span>
                <span className="mt-0.5 block text-[10px] text-[var(--muted)]">
                  {t.kind === "cohort" ? "Community" : "Direct"} · {previews[t.id] || "…"}
                </span>
              </button>
            ))
          )}
        </div>
        <button type="button" onClick={refreshThreads} className="w-full border-t border-[var(--border)] py-2 text-xs text-accent hover:underline">
          Refresh inbox
        </button>
      </aside>

      <div className="flex min-h-[480px] flex-col">
        {loading && (
          <p className="shrink-0 border-b border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)]">Loading...</p>
        )}
        <ChatFeed
          thread={activeThread}
          messages={messages}
          viewerRole="coach"
          emptyLabel="No messages in this thread yet."
        />
        {activeId && (
          <ChatThreadReply
            threadId={activeId}
            role="coach"
            placeholder="Quick reply in this thread..."
            onSent={() => loadMessages(activeId)}
          />
        )}
      </div>
    </div>
  );
}