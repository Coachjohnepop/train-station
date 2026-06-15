"use client";

import { useCallback, useEffect, useState } from "react";
import ChatFeed from "@/components/ChatFeed";
import MemberChatReply from "@/components/MemberChatReply";
import type { ChatMessage, ChatThread } from "@/lib/coach-chat";

export default function MemberChatWorkspace({ initialThreads }: { initialThreads: ChatThread[] }) {
  const [threads, setThreads] = useState(initialThreads);
  const [activeId, setActiveId] = useState(initialThreads[0]?.id || "");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const activeThread = threads.find((t) => t.id === activeId) || null;
  const showReply = activeThread?.kind === "member";

  const loadMessages = useCallback(async (threadId: string) => {
    if (!threadId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/messages?threadId=${encodeURIComponent(threadId)}&role=member`);
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

  return (
    <div className="space-y-4">
      {threads.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {threads.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveId(t.id)}
              className={`btn-ghost px-3 py-1 text-xs ${t.id === activeId ? "ring-1 ring-accent" : ""}`}
            >
              {t.title}
              {t.kind === "cohort" ? " (cohort)" : ""}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="text-xs text-[var(--muted)]">Loading...</p>}
      <ChatFeed
        thread={activeThread}
        messages={messages}
        viewerRole="member"
        emptyLabel="Your coach hasn't posted here yet."
      />
      {showReply && <MemberChatReply />}
    </div>
  );
}