"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ChatFeed from "@/components/ChatFeed";
import ChatThreadReply from "@/components/ChatThreadReply";
import CoachMemberChatPicker, { type CoachChatMember } from "@/components/CoachMemberChatPicker";
import type { ChatMessage, ChatThread } from "@/lib/coach-chat";

function threadPreview(messages: ChatMessage[]) {
  const last = messages[messages.length - 1];
  if (!last) return "No messages yet";
  const text = last.body || last.workoutTitle || (last.kind === "youtube" ? "Shared a video" : "Update");
  return text.length > 48 ? `${text.slice(0, 48)}…` : text;
}

function threadForMember(threads: ChatThread[], memberId: string) {
  return threads.find((t) => t.kind === "member" && t.memberId === memberId);
}

export default function AdminChatWorkspace({
  initialThreads,
  members,
}: {
  initialThreads: ChatThread[];
  members: CoachChatMember[];
}) {
  const cohortThreads = useMemo(
    () => initialThreads.filter((t) => t.kind === "cohort"),
    [initialThreads],
  );

  const defaultMember =
    members.find((m) => m.id === "demo-user-john-steph") || members[0] || null;
  const defaultThread = defaultMember
    ? threadForMember(initialThreads, defaultMember.id)
    : initialThreads.find((t) => t.kind === "member");

  const [threads, setThreads] = useState(initialThreads);
  const [activeMemberId, setActiveMemberId] = useState(defaultMember?.id || "");
  const [activeId, setActiveId] = useState(defaultThread?.id || "");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  const memberRows: CoachChatMember[] = useMemo(
    () =>
      members.map((m) => {
        const thread = threadForMember(threads, m.id);
        return {
          ...m,
          threadId: thread?.id,
          preview: thread ? previews[thread.id] : "No messages yet",
        };
      }),
    [members, threads, previews],
  );

  const activeThread =
    threads.find((t) => t.id === activeId) ||
    (activeMemberId ? threadForMember(threads, activeMemberId) : null) ||
    null;

  const loadMessages = useCallback(async (threadId: string, opts?: { quiet?: boolean }) => {
    if (!threadId) return;
    if (!opts?.quiet) setLoading(true);
    try {
      const res = await fetch(
        `/api/chat/messages?threadId=${encodeURIComponent(threadId)}&role=coach`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = await res.json();
      const msgs: ChatMessage[] = data.messages || [];
      setMessages((prev) =>
        prev.length === msgs.length && prev[prev.length - 1]?.id === msgs[msgs.length - 1]?.id
          ? prev
          : msgs
      );
      setPreviews((prev) => ({ ...prev, [threadId]: threadPreview(msgs) }));
      window.dispatchEvent(new CustomEvent("chat-unread-refresh"));
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, []);

  const selectMember = useCallback(
    async (memberId: string, threadId?: string) => {
      setActiveMemberId(memberId);
      let resolvedId = threadId || threadForMember(threads, memberId)?.id;

      if (!resolvedId) {
        const res = await fetch("/api/chat/threads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberId }),
        });
        if (res.ok) {
          const data = await res.json();
          const thread = data.thread as ChatThread;
          if (thread) {
            setThreads((prev) => (prev.some((t) => t.id === thread.id) ? prev : [...prev, thread]));
            resolvedId = thread.id;
          }
        }
      }

      if (resolvedId) setActiveId(resolvedId);
    },
    [threads],
  );

  useEffect(() => {
    if (activeId) loadMessages(activeId);
  }, [activeId, loadMessages]);

  // Poll so incoming member messages appear live (quiet refresh, no spinner).
  useEffect(() => {
    if (!activeId) return;
    const id = setInterval(() => loadMessages(activeId, { quiet: true }), 6000);
    return () => clearInterval(id);
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
  }

  function selectCohort(threadId: string) {
    setActiveMemberId("");
    setActiveId(threadId);
  }

  return (
    <div className="grid min-h-[560px] gap-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm lg:grid-cols-[minmax(220px,260px)_1fr]">
      <aside className="border-b border-[var(--border)] lg:border-b-0 lg:border-r">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Inbox</p>
          <p className="text-[11px] text-[var(--muted)]">Live &amp; asynch members</p>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-2">
          <CoachMemberChatPicker
            members={memberRows}
            activeMemberId={activeMemberId}
            onSelect={selectMember}
            layout="sidebar"
          />
          {cohortThreads.length > 0 && (
            <details className="group mt-3 border-t border-[var(--border)] pt-2" open>
              <summary className="flex cursor-pointer list-none items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                <span className="text-accent group-open:rotate-90 transition-transform">▶</span>
                Community
              </summary>
              <div className="mt-1 px-1">
                {cohortThreads.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectCohort(t.id)}
                    className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left transition ${
                      t.id === activeId ? "bg-accent/15 ring-1 ring-accent/40" : "hover:bg-[var(--surface-2)]"
                    }`}
                  >
                    <span className="block truncate text-sm font-medium">{t.title}</span>
                    <span className="mt-0.5 block text-[10px] text-[var(--muted)]">
                      Cohort · {previews[t.id] || "…"}
                    </span>
                  </button>
                ))}
              </div>
            </details>
          )}
        </div>
        <button
          type="button"
          onClick={refreshThreads}
          className="w-full border-t border-[var(--border)] py-2 text-xs text-accent hover:underline"
        >
          Refresh inbox
        </button>
      </aside>

      <div className="flex min-h-[480px] flex-col">
        <div className="shrink-0 border-b border-[var(--border)] px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Conversation
          </p>
          <CoachMemberChatPicker
            members={memberRows}
            activeMemberId={activeMemberId}
            onSelect={selectMember}
            layout="header"
          />
        </div>

        {loading && (
          <p className="shrink-0 border-b border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)]">Loading...</p>
        )}
        <ChatFeed
          thread={activeThread}
          messages={messages}
          viewerRole="coach"
          emptyLabel="No messages in this thread yet."
          hideHeader
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