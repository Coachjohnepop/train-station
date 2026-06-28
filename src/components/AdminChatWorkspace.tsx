"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ChatFeed from "@/components/ChatFeed";
import ChatThreadReply from "@/components/ChatThreadReply";
import CoachMemberChatPicker, { type CoachChatMember } from "@/components/CoachMemberChatPicker";
import type { ChatMessage, ChatThread } from "@/lib/coach-chat";
import { applyChatMessageLoad } from "@/lib/chat-message-merge";
import {
  CHAT_COHORT_COLORS,
  CHAT_MODE_COLORS,
  memberAvatarColor,
  memberInitials,
} from "@/lib/chat-colors";
import type { MemberCoachingMode } from "@/lib/member-coaching-mode";

function threadPreview(messages: ChatMessage[]) {
  const last = messages[messages.length - 1];
  if (!last) return "No messages yet";
  const text =
    last.body ||
    last.workoutTitle ||
    (last.kind === "youtube" ? "Shared a video" : last.kind === "image" ? "Shared a photo" : last.kind === "video_upload" ? "Shared a clip" : "Update");
  return text.length > 48 ? `${text.slice(0, 48)}…` : text;
}

function threadForMember(threads: ChatThread[], memberId: string) {
  return threads.find((t) => t.kind === "member" && t.memberId === memberId);
}

function InboxLegend() {
  return (
    <div className="flex flex-wrap gap-2 px-3 py-2 text-[9px] font-semibold uppercase tracking-wide">
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ring-1 ${CHAT_MODE_COLORS.live.chip} ${CHAT_MODE_COLORS.live.chipText}`}>
        <span className={`h-2 w-2 rounded-full ${CHAT_MODE_COLORS.live.stripe}`} />
        Live
      </span>
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ring-1 ${CHAT_MODE_COLORS.async.chip} ${CHAT_MODE_COLORS.async.chipText}`}>
        <span className={`h-2 w-2 rounded-full ${CHAT_MODE_COLORS.async.stripe}`} />
        Asynch
      </span>
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ring-1 ${CHAT_COHORT_COLORS.chip} ${CHAT_COHORT_COLORS.chipText}`}>
        <span className={`h-2 w-2 rounded-full ${CHAT_COHORT_COLORS.stripe}`} />
        Community
      </span>
    </div>
  );
}

export default function AdminChatWorkspace({
  initialThreads,
  members,
  initialUnreadByThread = {},
}: {
  initialThreads: ChatThread[];
  members: CoachChatMember[];
  initialUnreadByThread?: Record<string, number>;
}) {
  const cohortThreads = useMemo(
    () => initialThreads.filter((t) => t.kind === "cohort"),
    [initialThreads],
  );

  function pickUnreadTarget(
    threadList: ChatThread[],
    memberList: CoachChatMember[],
    unread: Record<string, number>,
  ) {
    const top = Object.entries(unread)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])[0];
    if (!top) return null;
    const thread = threadList.find((t) => t.id === top[0]);
    if (!thread?.memberId) return null;
    const member = memberList.find((m) => m.id === thread.memberId);
    if (!member) return null;
    return { memberId: member.id, threadId: thread.id };
  }

  const unreadTarget = pickUnreadTarget(initialThreads, members, initialUnreadByThread);
  const defaultMember =
    (unreadTarget && members.find((m) => m.id === unreadTarget.memberId)) || members[0] || null;
  const defaultThread = unreadTarget
    ? initialThreads.find((t) => t.id === unreadTarget.threadId)
    : defaultMember
      ? threadForMember(initialThreads, defaultMember.id)
      : initialThreads.find((t) => t.kind === "member");

  const [threads, setThreads] = useState(initialThreads);
  const [activeMemberId, setActiveMemberId] = useState(defaultMember?.id || "");
  const [activeId, setActiveId] = useState(defaultThread?.id || "");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [unreadByThread, setUnreadByThread] = useState<Record<string, number>>(initialUnreadByThread);
  const [mobilePanel, setMobilePanel] = useState<"inbox" | "chat">("inbox");

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

  const activeMember = members.find((m) => m.id === activeMemberId) || null;
  const activeMode: MemberCoachingMode | "cohort" =
    activeThread?.kind === "cohort" ? "cohort" : activeMember?.coachingMode || "async";

  const headerAccent =
    activeMode === "cohort"
      ? CHAT_COHORT_COLORS.section
      : CHAT_MODE_COLORS[activeMode as MemberCoachingMode].section;

  const loadMessages = useCallback(async (threadId: string, opts?: { quiet?: boolean; replace?: boolean }) => {
    if (!threadId) return;
    if (!opts?.quiet) setLoading(true);
    try {
      const res = await fetch(
        `/api/chat/messages?threadId=${encodeURIComponent(threadId)}&role=coach`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = await res.json();
      const msgs: ChatMessage[] = data.messages || [];
      setMessages((prev) => {
        const next = applyChatMessageLoad(prev, msgs, { replace: opts?.replace });
        setPreviews((p) => ({ ...p, [threadId]: threadPreview(next) }));
        return next;
      });
      window.dispatchEvent(new CustomEvent("chat-unread-refresh"));
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, []);

  const refreshUnread = useCallback(async () => {
    const res = await fetch("/api/chat/threads?role=coach", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setUnreadByThread(data.unreadByThread || {});
  }, []);

  const selectMember = useCallback(
    async (memberId: string, threadId?: string) => {
      setActiveMemberId(memberId);
      setMobilePanel("chat");
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

  // Ensure a real thread exists when a member is selected (e.g. after chat reset).
  useEffect(() => {
    if (!activeMemberId) return;
    if (threadForMember(threads, activeMemberId)) return;
    void selectMember(activeMemberId);
  }, [activeMemberId, threads, selectMember]);

  useEffect(() => {
    const resolved = activeMemberId ? threadForMember(threads, activeMemberId) : null;
    if (resolved && resolved.id !== activeId) {
      setActiveId(resolved.id);
    }
  }, [activeMemberId, threads, activeId]);

  const replyThreadId = activeThread?.id || activeId;
  const visibleMessages = useMemo(
    () => messages.filter((m) => m.threadId === replyThreadId),
    [messages, replyThreadId],
  );

  useEffect(() => {
    if (!replyThreadId) return;
    void loadMessages(replyThreadId, { replace: true });
  }, [replyThreadId, loadMessages]);

  useEffect(() => {
    void refreshUnread();
  }, [refreshUnread]);

  useEffect(() => {
    if (!replyThreadId) return;
    const id = setInterval(() => {
      loadMessages(replyThreadId, { quiet: true });
      void refreshUnread();
    }, 6000);
    return () => clearInterval(id);
  }, [replyThreadId, loadMessages, refreshUnread]);

  useEffect(() => {
    function onPosted() {
      void refreshThreads();
      if (replyThreadId) void loadMessages(replyThreadId);
      void refreshUnread();
    }
    window.addEventListener("coach-chat-posted", onPosted);
    return () => window.removeEventListener("coach-chat-posted", onPosted);
  }, [replyThreadId, loadMessages, refreshUnread]);

  async function refreshThreads() {
    const res = await fetch("/api/chat/threads?role=coach");
    if (!res.ok) return;
    const data = await res.json();
    setThreads(data.threads || []);
    setUnreadByThread(data.unreadByThread || {});
  }

  function selectCohort(threadId: string) {
    setActiveMemberId("");
    setActiveId(threadId);
    setMobilePanel("chat");
  }

  const totalUnread = Object.values(unreadByThread).reduce((n, c) => n + c, 0);

  const conversationTitle =
    activeThread?.kind === "cohort"
      ? activeThread.title
      : activeMember?.name || activeThread?.title || "Conversation";

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      {/* Mobile tab bar */}
      <div className="flex border-b border-[var(--border)] lg:hidden">
        <button
          type="button"
          onClick={() => setMobilePanel("inbox")}
          className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-semibold transition ${
            mobilePanel === "inbox"
              ? "border-b-2 border-violet-400 bg-violet-500/10 text-violet-200"
              : "text-[var(--muted)]"
          }`}
        >
          Inbox
          {totalUnread > 0 && (
            <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
              {totalUnread}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => activeId && setMobilePanel("chat")}
          disabled={!activeId}
          className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-semibold transition ${
            mobilePanel === "chat"
              ? "border-b-2 border-emerald-400 bg-emerald-500/10 text-emerald-200"
              : "text-[var(--muted)] disabled:opacity-40"
          }`}
        >
          Chat
        </button>
      </div>

      <div className="grid min-h-[min(70vh,560px)] gap-0 lg:grid-cols-[minmax(240px,280px)_1fr]">
        {/* Inbox — full screen on mobile when selected */}
        <aside
          className={`border-b border-[var(--border)] lg:border-b-0 lg:border-r ${
            mobilePanel === "inbox" ? "block" : "hidden lg:block"
          }`}
        >
          <div className="border-b border-[var(--border)] bg-violet-950/25 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-violet-200">Inbox</p>
            <p className="text-[11px] text-[var(--muted)]">Tap a member — colors show Live vs Asynch</p>
          </div>
          <InboxLegend />
          <div className="max-h-[min(50vh,420px)] overflow-y-auto p-2 lg:max-h-[420px]">
            <CoachMemberChatPicker
              members={memberRows}
              activeMemberId={activeMemberId}
              onSelect={selectMember}
              layout="sidebar"
              unreadByThread={unreadByThread}
            />
            {cohortThreads.length > 0 && (
              <details className={`group mt-3 rounded-lg border px-1 pt-1 ${CHAT_COHORT_COLORS.section}`} open>
                <summary className={`flex cursor-pointer list-none items-center gap-2 px-2 py-2 text-xs font-bold uppercase tracking-wide ${CHAT_COHORT_COLORS.chipText}`}>
                  <span className="transition-transform group-open:rotate-90">▶</span>
                  Community
                </summary>
                <div className="mt-1 px-1 pb-1">
                  {cohortThreads.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => selectCohort(t.id)}
                      className={`relative mb-1.5 flex w-full min-h-[48px] items-center rounded-xl px-3 py-2.5 text-left transition ${
                        t.id === activeId ? `${CHAT_COHORT_COLORS.section} ring-1` : "hover:bg-[var(--surface-2)]"
                      }`}
                    >
                      <span className={`absolute left-0 top-2 bottom-2 w-1 rounded-full ${CHAT_COHORT_COLORS.stripe}`} />
                      <span className="ml-2 min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{t.title}</span>
                        <span className="mt-0.5 block truncate text-[10px] text-[var(--muted)]">
                          Cohort · {previews[t.id] || "…"}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </details>
            )}
          </div>
          <button
            type="button"
            onClick={() => void refreshThreads()}
            className="w-full border-t border-[var(--border)] py-2.5 text-xs font-medium text-violet-300 hover:underline"
          >
            Refresh inbox
          </button>
        </aside>

        {/* Conversation */}
        <div
          className={`flex min-h-[min(60vh,480px)] flex-col ${
            mobilePanel === "chat" ? "flex" : "hidden lg:flex"
          }`}
        >
          <div className={`shrink-0 border-b border-[var(--border)] px-3 py-3 ${headerAccent}`}>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobilePanel("inbox")}
                className="lg:hidden rounded-lg bg-[var(--surface-2)] px-2.5 py-1.5 text-xs font-semibold text-[var(--muted)]"
              >
                ← Inbox
              </button>
              {activeMember && activeThread?.kind === "member" && (
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${memberAvatarColor(activeMember.id)}`}
                >
                  {memberInitials(activeMember.name)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold">{conversationTitle}</p>
                <p className="text-[11px] text-[var(--muted)]">
                  {activeThread?.kind === "cohort"
                    ? "Community broadcast"
                    : activeMode === "live"
                      ? "Live member · 1:1 thread"
                      : "Asynch member · 1:1 thread"}
                </p>
              </div>
            </div>
            <div className="mt-2 hidden lg:block">
              <CoachMemberChatPicker
                members={memberRows}
                activeMemberId={activeMemberId}
                onSelect={selectMember}
                layout="header"
                unreadByThread={unreadByThread}
              />
            </div>
          </div>

          {loading && visibleMessages.length === 0 && (
            <p className="shrink-0 border-b border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)]">
              Loading…
            </p>
          )}
          <ChatFeed
            thread={activeThread}
            messages={visibleMessages}
            viewerRole="coach"
            viewerId="coach"
            emptyLabel="No messages in this thread yet."
            hideHeader
            onReactionChange={(updated) =>
              setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
            }
          />
          {replyThreadId && activeMemberId && (
            <ChatThreadReply
              threadId={replyThreadId}
              role="coach"
              placeholder="Quick reply…"
              onSent={(message) => {
                if (!message) return;
                setMessages((prev) => {
                  if (prev.some((m) => m.id === message.id)) return prev;
                  const next = [...prev, message].sort(
                    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
                  );
                  setPreviews((p) => ({ ...p, [replyThreadId]: threadPreview(next) }));
                  return next;
                });
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}