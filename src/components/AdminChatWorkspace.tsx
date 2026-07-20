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
import { COMMUNITY_NO_BROADCAST_NOTE } from "@/lib/community-feed";
import {
  ChatResizeDivider,
  useDesktopChatLayout,
  useStoredPanelSize,
} from "@/lib/chat-panel-resize";

/**
 * Stick jelly-bean strip under slim Messages chrome (coach-messages-sticky-chrome)
 * or under the generic mobile app header when not in messages-focus shell.
 */
function useCoachChromeOffset(): number {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const sync = () => {
      // Prefer the slim Messages focus header when present.
      const messagesChrome = document.querySelector(".coach-messages-sticky-chrome");
      if (messagesChrome instanceof HTMLElement) {
        // Main scrolls under a sticky header outside main → sticky top: 0 inside main.
        setOffset(0);
        return;
      }
      let top = 0;
      if (!window.matchMedia("(min-width: 1280px)").matches) {
        const header = document.querySelector("header.app-shell-header");
        if (header instanceof HTMLElement) {
          top += Math.ceil(header.getBoundingClientRect().height);
        }
      }
      setOffset(top);
    };
    sync();
    window.addEventListener("resize", sync);
    const ro = new ResizeObserver(sync);
    const el =
      document.querySelector(".coach-messages-sticky-chrome") ||
      document.querySelector("header.app-shell-header");
    if (el instanceof HTMLElement) ro.observe(el);
    return () => {
      window.removeEventListener("resize", sync);
      ro.disconnect();
    };
  }, []);
  return offset;
}

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
  initialMemberId,
}: {
  initialThreads: ChatThread[];
  members: CoachChatMember[];
  initialUnreadByThread?: Record<string, number>;
  initialMemberId?: string;
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
  const linkedMember = initialMemberId
    ? members.find((m) => m.id === initialMemberId)
    : null;
  const defaultMember =
    linkedMember ||
    (unreadTarget && members.find((m) => m.id === unreadTarget.memberId)) ||
    members[0] ||
    null;
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
  const { size: inboxWidth, setSize: setInboxWidth } = useStoredPanelSize(
    "ts-admin-chat-inbox-width",
    280,
    200,
    440,
  );
  const { size: workspaceHeight, setSize: setWorkspaceHeight } = useStoredPanelSize(
    "ts-admin-chat-height",
    560,
    400,
    920,
  );
  const { size: feedHeight, setSize: setFeedHeight } = useStoredPanelSize(
    "ts-admin-chat-feed-height",
    340,
    160,
    720,
  );
  const isDesktopChat = useDesktopChatLayout();

  const memberRows: CoachChatMember[] = useMemo(() => {
    const rows = members.map((m) => {
      const thread = threadForMember(threads, m.id);
      return {
        ...m,
        threadId: thread?.id,
        preview: thread ? previews[thread.id] : "No messages yet",
      };
    });
    // Unread first — liberal badge use means coaches see who needs attention.
    return rows.sort((a, b) => {
      const ua = a.threadId ? unreadByThread[a.threadId] || 0 : 0;
      const ub = b.threadId ? unreadByThread[b.threadId] || 0 : 0;
      if (ub !== ua) return ub - ua;
      return a.name.localeCompare(b.name);
    });
  }, [members, threads, previews, unreadByThread]);

  const clearThreadBadge = useCallback(
    async (threadId: string) => {
      if (!threadId) return;
      const res = await fetch("/api/chat/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setUnreadByThread(data.unreadByThread || {});
      window.dispatchEvent(new CustomEvent("chat-unread-refresh"));
    },
    [],
  );

  const clearAllBadges = useCallback(async () => {
    const res = await fetch("/api/chat/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setUnreadByThread(data.unreadByThread || {});
    window.dispatchEvent(new CustomEvent("chat-unread-refresh"));
  }, []);

  const reflagThreadBadge = useCallback(async (threadId: string) => {
    if (!threadId) return;
    const res = await fetch("/api/chat/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, reflag: true }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setUnreadByThread(data.unreadByThread || {});
    window.dispatchEvent(new CustomEvent("chat-unread-refresh"));
  }, []);

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
    // Keep left-nav / bottom Msgs / top Messages badges in sync with jelly beans.
    window.dispatchEvent(new CustomEvent("chat-unread-refresh"));
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
    function onPosted(event: Event) {
      const detail = (event as CustomEvent<{ audience?: string; threadIds?: string[] }>).detail;
      void refreshThreads().then(() => {
        if (detail?.audience === "cohort" && detail.threadIds?.[0]) {
          selectCohort(detail.threadIds[0]);
          void loadMessages(detail.threadIds[0], { replace: true });
        } else if (replyThreadId) {
          void loadMessages(replyThreadId);
        }
      });
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
  const chromeOffset = useCoachChromeOffset();

  const conversationTitle =
    activeThread?.kind === "cohort"
      ? activeThread.title
      : activeMember?.name || activeThread?.title || "Conversation";

  return (
    <div className="space-y-0">
      {/*
        Jelly-bean strip: sticky + large touch targets so coaches can always tap a member.
        Slim messages shell keeps this under a short header (top: 0).
      */}
      <div
        className="admin-chat-threads-lock sticky z-40 mb-2 rounded-xl border border-violet-400/50 bg-[color-mix(in_srgb,var(--bg)_88%,var(--surface))] shadow-[0_10px_28px_rgba(0,0,0,0.28)] backdrop-blur-md"
        style={{ top: Math.max(0, chromeOffset) }}
      >
        <div className="flex items-center gap-1 border-b border-[var(--border)]/80 px-2 py-1">
          <button
            type="button"
            onClick={() => setMobilePanel("inbox")}
            className={`relative min-h-[40px] rounded-lg px-2.5 text-[11px] font-semibold lg:hidden ${
              mobilePanel === "inbox"
                ? "bg-violet-500/20 text-violet-100"
                : "text-[var(--muted)]"
            }`}
          >
            List
            {totalUnread > 0 ? (
              <span className="ml-1 inline-flex h-5 min-w-[18px] items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[10px] font-bold text-white">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            ) : null}
          </button>
          <p className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate text-[10px] font-bold uppercase tracking-wide text-violet-200/90">
            Tap a member
            {totalUnread > 0 ? (
              <span className="inline-flex h-5 min-w-[18px] items-center justify-center rounded-full bg-[#ff3b30] px-1.5 text-[10px] font-bold normal-case tracking-normal text-white">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            ) : null}
          </p>
          {totalUnread > 0 ? (
            <button
              type="button"
              onClick={() => void clearAllBadges()}
              className="min-h-[40px] shrink-0 rounded-lg border border-violet-400/40 bg-violet-500/15 px-2 text-[10px] font-semibold text-violet-100"
            >
              Clear badges
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void refreshThreads()}
            className="min-h-[40px] shrink-0 px-2 text-[10px] font-medium text-violet-300"
          >
            ↻
          </button>
        </div>

        {/* Jelly beans — red badge on every unread thread (avatar corner + count) */}
        <div className="flex gap-2 overflow-x-auto px-2 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {memberRows.map((m) => {
            const threadId =
              m.threadId ||
              threads.find((t) => t.kind === "member" && t.memberId === m.id)?.id;
            const unread = threadId ? unreadByThread[threadId] || 0 : 0;
            const active = m.id === activeMemberId;
            const modeColors = CHAT_MODE_COLORS[m.coachingMode];
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => selectMember(m.id, threadId)}
                className={`relative inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition active:scale-[0.98] ${
                  active
                    ? `${modeColors.chip} ring-2 ring-offset-1 ring-offset-[var(--bg)] ${modeColors.chipText}`
                    : unread > 0
                      ? "bg-rose-500/15 text-[var(--text)] ring-2 ring-rose-400/60"
                      : "bg-[var(--surface-2)] text-[var(--muted)] ring-1 ring-[var(--border)] hover:text-[var(--foreground)]"
                }`}
                title={
                  unread > 0
                    ? `${m.name} · ${unread} unread`
                    : m.name
                }
              >
                <span className="relative">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white ${memberAvatarColor(m.id)}`}
                  >
                    {memberInitials(m.name)}
                  </span>
                  {unread > 0 ? (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[10px] font-bold text-white shadow ring-2 ring-[var(--bg)]">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-[8rem] truncate">{m.name.split(" ")[0]}</span>
                {unread > 0 ? (
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#ff3b30] px-1.5 text-[10px] font-bold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                ) : null}
              </button>
            );
          })}
          {cohortThreads.map((t) => {
            const unread = unreadByThread[t.id] || 0;
            const active = t.id === activeId && !activeMemberId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => selectCohort(t.id)}
                className={`relative inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition active:scale-[0.98] ${
                  active
                    ? `${CHAT_COHORT_COLORS.chip} ring-2 ${CHAT_COHORT_COLORS.chipText}`
                    : unread > 0
                      ? "bg-rose-500/15 text-[var(--text)] ring-2 ring-rose-400/60"
                      : "bg-[var(--surface-2)] text-[var(--muted)] ring-1 ring-[var(--border)]"
                }`}
                title={unread > 0 ? `${t.title} · ${unread} unread` : t.title}
              >
                <span className="relative">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                    G
                  </span>
                  {unread > 0 ? (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[10px] font-bold text-white shadow ring-2 ring-[var(--bg)]">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-[9rem] truncate">{t.title}</span>
                {unread > 0 ? (
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#ff3b30] px-1.5 text-[10px] font-bold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                ) : null}
              </button>
            );
          })}
          {memberRows.length === 0 && cohortThreads.length === 0 ? (
            <p className="px-2 py-2 text-xs text-[var(--muted)]">No threads yet.</p>
          ) : null}
        </div>
      </div>

      <div className="chat-thread-shell overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div
          className="flex min-h-[min(70vh,560px)] flex-col lg:min-h-0 lg:flex-row"
          style={
            isDesktopChat
              ? { height: workspaceHeight }
              : { height: "min(68dvh, calc(100dvh - 12rem))" }
          }
        >
        {/* Inbox — full screen on mobile when selected (detailed list) */}
        <aside
          className={`flex min-h-0 w-full flex-col border-b border-[var(--border)] lg:shrink-0 lg:border-b-0 lg:border-r ${
            mobilePanel === "inbox" ? "flex" : "hidden lg:flex"
          }`}
          style={isDesktopChat ? { width: inboxWidth } : undefined}
        >
          <div className="border-b border-[var(--border)] bg-violet-950/25 px-4 py-2">
            <p className="text-[11px] text-[var(--muted)]">
              Detailed inbox · badges stay until you clear or reply · unread sorted first
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2 max-h-[min(50vh,420px)] lg:max-h-none">
            <CoachMemberChatPicker
              members={memberRows}
              activeMemberId={activeMemberId}
              onSelect={selectMember}
              layout="sidebar"
              unreadByThread={unreadByThread}
            />
            {cohortThreads.length > 0 && (
              <div className={`mt-3 rounded-lg border px-1 pt-1 ${CHAT_COHORT_COLORS.section}`}>
                <p className={`px-2 py-2 text-xs font-bold uppercase tracking-wide ${CHAT_COHORT_COLORS.chipText}`}>
                  Group messages
                </p>
                <p className="px-2 pb-2 text-[10px] text-[var(--muted)]">
                  Sender name on every post · {COMMUNITY_NO_BROADCAST_NOTE}
                </p>
                <div className="px-1 pb-1">
                  {cohortThreads.map((t) => {
                    const cohortUnread = unreadByThread[t.id] || 0;
                    return (
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
                          {previews[t.id] || "No posts yet"}
                        </span>
                      </span>
                      {cohortUnread > 0 && (
                        <span className="ml-1 flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[#ff3b30] px-1.5 text-[10px] font-bold text-white">
                          {cohortUnread > 9 ? "9+" : cohortUnread}
                        </span>
                      )}
                    </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </aside>

        {isDesktopChat ? (
          <ChatResizeDivider
            direction="column"
            label="Resize inbox width"
            onDelta={(delta) => setInboxWidth((w) => w + delta)}
          />
        ) : null}

        {/* Conversation */}
        <div
          className={`flex min-w-0 flex-1 flex-col min-h-[min(60vh,480px)] lg:min-h-0 ${
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
                {totalUnread > 0 && (
                  <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[9px] font-bold text-white">
                    {totalUnread > 9 ? "9+" : totalUnread}
                  </span>
                )}
              </button>
              {activeMember && activeThread?.kind === "member" && (
                <span
                  className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${memberAvatarColor(activeMember.id)}`}
                >
                  {memberInitials(activeMember.name)}
                  {(activeId && unreadByThread[activeId] ? unreadByThread[activeId] : 0) > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[10px] font-bold text-white ring-2 ring-[var(--surface)]">
                      {(unreadByThread[activeId] || 0) > 9 ? "9+" : unreadByThread[activeId]}
                    </span>
                  )}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-base font-semibold">{conversationTitle}</p>
                  {activeId && (unreadByThread[activeId] || 0) > 0 && (
                    <span className="inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[#ff3b30] px-1.5 text-[10px] font-bold text-white">
                      {(unreadByThread[activeId] || 0) > 9 ? "9+" : unreadByThread[activeId]}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--muted)]">
                  {activeThread?.kind === "cohort"
                    ? COMMUNITY_NO_BROADCAST_NOTE
                    : activeMode === "live"
                      ? "Live member · 1:1 thread"
                      : "Asynch member · 1:1 thread"}
                  {" · Coach left · member right"}
                </p>
              </div>
              {replyThreadId ? (
                <div className="flex shrink-0 flex-col gap-1">
                  {(unreadByThread[replyThreadId] || 0) > 0 ? (
                    <button
                      type="button"
                      onClick={() => void clearThreadBadge(replyThreadId)}
                      className="rounded-lg border border-rose-400/40 bg-rose-500/15 px-2.5 py-1.5 text-[10px] font-bold text-rose-100 hover:bg-rose-500/25"
                      title="Clear badge now — messages stay. New member replies badge again."
                    >
                      Clear badge
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void reflagThreadBadge(replyThreadId)}
                      className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-amber-100 hover:bg-amber-500/20"
                      title="Put the badge back so you remember to follow up later"
                    >
                      Badge for later
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div
              className="flex min-h-0 flex-col overflow-hidden lg:shrink-0"
              style={isDesktopChat ? { height: feedHeight } : undefined}
            >
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
            </div>

            {isDesktopChat ? (
              <ChatResizeDivider
                direction="row"
                label="Resize message thread height"
                onDelta={(delta) => setFeedHeight((h) => h + delta)}
              />
            ) : null}

            {replyThreadId ? (
              <div className="min-h-0 shrink-0">
                <ChatThreadReply
                  threadId={replyThreadId}
                  role="coach"
                  threadKind={activeThread?.kind}
                  memberName={activeMember?.name || activeThread?.title || null}
                  placeholder={activeThread?.kind === "cohort" ? "Reply in community feed…" : "Quick reply…"}
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
              </div>
            ) : null}
          </div>
        </div>
        </div>

        {isDesktopChat ? (
          <ChatResizeDivider
            direction="row"
            className="chat-resize-divider--edge"
            label="Resize chat workspace height"
            onDelta={(delta) => setWorkspaceHeight((h) => h + delta)}
          />
        ) : null}
      </div>
    </div>
  );
}
