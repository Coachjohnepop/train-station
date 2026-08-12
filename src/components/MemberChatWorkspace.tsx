"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ChatFeed from "@/components/ChatFeed";
import ChatThreadReply from "@/components/ChatThreadReply";
import FreeUpgradeTease from "@/components/FreeUpgradeTease";
import type { ChatMessage, ChatThread } from "@/lib/coach-chat";
import { applyChatMessageLoad } from "@/lib/chat-message-merge";
import { DEMO_COACH } from "@/lib/demo-coach";
import {
  ChatResizeDivider,
  useDesktopChatLayout,
  useStoredPanelSize,
} from "@/lib/chat-panel-resize";
import { FREE_COACH_CHAT_SOFT_CAP, isFreeExplorerPlan } from "@/lib/free-tier-product";

/** Stick thread tabs just under the frozen MemberShell chrome. */
function useMemberChromeOffset(): number {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const chrome = document.querySelector(".member-sticky-chrome");
    if (!(chrome instanceof HTMLElement)) return;
    const sync = () => setOffset(Math.ceil(chrome.getBoundingClientRect().height));
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(chrome);
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, []);
  return offset;
}

/** Coach 1:1 first (default board), then community / group feeds. */
function orderThreads(threads: ChatThread[]) {
  const direct = threads.filter((t) => t.kind === "member");
  const cohorts = threads.filter((t) => t.kind === "cohort");
  return [...direct, ...cohorts];
}

function threadLabel(thread: ChatThread) {
  if (thread.kind === "cohort") return `${thread.title} · Group`;
  return `Coach · ${DEMO_COACH.displayName}`;
}

/** Short jelly-bean label — fits many groups on one phone screen without side-scroll. */
function beanLabel(thread: ChatThread) {
  if (thread.kind === "member") return "Coach";
  const raw = (thread.title || "Group").trim();
  // Drop noisy suffixes so beans stay tiny: "Adult · Group" → "Adult"
  const short = raw
    .replace(/\s*[·•|-]\s*group\s*$/i, "")
    .replace(/\s+group\s*$/i, "")
    .trim();
  if (short.length <= 14) return short || "Group";
  return `${short.slice(0, 12)}…`;
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
  /** Staff (John/Jeremy) post as coach so group sends work from this UI. */
  asCoach = false,
  membershipPlan = null,
}: {
  initialThreads: ChatThread[];
  memberId: string;
  asCoach?: boolean;
  membershipPlan?: string | null;
}) {
  const freeExplorer = isFreeExplorerPlan(membershipPlan) && !asCoach;
  const orderedInitial = useMemo(() => orderThreads(initialThreads), [initialThreads]);
  const defaultDirect = orderedInitial.find((t) => t.kind === "member");
  const defaultCommunity = orderedInitial.find((t) => t.kind === "cohort");

  const tabStorageKey = `ts-member-chat-tab:${memberId}`;

  const [threads, setThreads] = useState(orderedInitial);
  // Default to coach board (not community)
  const [activeId, setActiveId] = useState(
    defaultDirect?.id || defaultCommunity?.id || orderedInitial[0]?.id || "",
  );
  const [unreadByThread, setUnreadByThread] = useState<Record<string, number>>({});
  const [tabReady, setTabReady] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(tabStorageKey);
      if (saved && orderedInitial.some((t) => t.id === saved)) {
        setActiveId(saved);
      }
    } catch {
      /* ignore */
    }
    setTabReady(true);
  }, [tabStorageKey, orderedInitial]);

  useEffect(() => {
    if (!tabReady || !activeId) return;
    try {
      sessionStorage.setItem(tabStorageKey, activeId);
    } catch {
      /* ignore */
    }
  }, [activeId, tabReady, tabStorageKey]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const isDesktopChat = useDesktopChatLayout();
  const { size: workspaceHeight, setSize: setWorkspaceHeight } = useStoredPanelSize(
    "ts-member-chat-height",
    520,
    400,
    920,
  );
  const { size: feedHeight, setSize: setFeedHeight } = useStoredPanelSize(
    "ts-member-chat-feed-height",
    360,
    160,
    720,
  );

  const orderedThreads = useMemo(() => orderThreads(threads), [threads]);
  const activeThread = threads.find((t) => t.id === activeId) || null;
  const freeOnCohort = freeExplorer && activeThread?.kind === "cohort";
  const feedThread = displayThread(activeThread);
  const visibleMessages = useMemo(
    () => messages.filter((m) => m.threadId === activeId),
    [messages, activeId],
  );
  const freeMemberMsgCount = useMemo(
    () => visibleMessages.filter((m) => m.authorRole === "member").length,
    [visibleMessages],
  );

  const loadMessages = useCallback(
    async (threadId: string, opts?: { quiet?: boolean; replace?: boolean }) => {
      if (!threadId) return;
      if (!opts?.quiet) setLoading(true);
      try {
        const res = await fetch(
          `/api/chat/messages?threadId=${encodeURIComponent(threadId)}&role=${asCoach ? "coach" : "member"}`,
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
    [asCoach],
  );

  const refreshUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/threads?role=member", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.threads)) setThreads(orderThreads(data.threads));
      setUnreadByThread(data.unreadByThread || {});
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setThreads(orderThreads(initialThreads));
  }, [initialThreads]);

  useEffect(() => {
    void refreshUnread();
    const id = setInterval(() => void refreshUnread(), 12000);
    const onRefresh = () => void refreshUnread();
    window.addEventListener("chat-unread-refresh", onRefresh);
    return () => {
      clearInterval(id);
      window.removeEventListener("chat-unread-refresh", onRefresh);
    };
  }, [refreshUnread]);

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
  const replyRole = asCoach ? "coach" : "member";
  const replyPlaceholder = asCoach
    ? activeReplyThread?.kind === "cohort"
      ? "Post to this group as coach..."
      : "Message as coach..."
    : activeReplyThread?.kind === "cohort"
      ? "Comment on this post..."
      : "Message your coach...";
  const replyDestination = asCoach
    ? activeReplyThread?.kind === "cohort"
      ? "Posting as coach · Group feed"
      : "Posting as coach · Direct thread"
    : activeReplyThread?.kind === "cohort"
      ? "Posting to · Community feed"
      : "Posting to · Direct message with coach";

  const totalUnread = Object.values(unreadByThread).reduce((n, c) => n + c, 0);
  const chromeOffset = useMemberChromeOffset();

  return (
    <div className="space-y-3">
      {freeExplorer ? (
        <FreeUpgradeTease
          compact
          title="Coach 1:1 on Free Explorer"
          body="Group / community posts are Coach Class+. Keep messaging Jeremy here — upgrade to post in every room."
        />
      ) : null}
      {freeOnCohort ? (
        <FreeUpgradeTease
          title="This group is behind the velvet rope"
          body="You can read the vibe. Coach Class unlocks posting in program communities."
        />
      ) : null}
      {freeExplorer &&
      !freeOnCohort &&
      freeMemberMsgCount >= FREE_COACH_CHAT_SOFT_CAP ? (
        <FreeUpgradeTease
          compact
          title="You're active with coach"
          body={`After ${FREE_COACH_CHAT_SOFT_CAP}+ messages, Coach Class adds groups, macros, and priority reply.`}
        />
      ) : null}
      {/*
        Sticky under MemberShell chrome: all threads + badges stay on screen while
        page title / message feed scroll. Outside overflow-hidden shell so sticky works.
      */}
      <div
        className="member-chat-threads-lock sticky z-40 -mx-1 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_92%,var(--surface))] px-3 py-2.5 shadow-[0_10px_28px_rgba(0,0,0,0.22)] backdrop-blur-md"
        style={{ top: chromeOffset > 0 ? chromeOffset : 0 }}
      >
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">
            Threads
            {totalUnread > 0 ? (
              <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[9px] font-bold normal-case tracking-normal text-white">
                {totalUnread > 9 ? "9+" : totalUnread}
              </span>
            ) : null}
          </p>
          <p className="text-[10px] text-[var(--muted)]">
            {totalUnread > 0 ? "Tap the red bean" : "All groups on one row"}
          </p>
        </div>
        {/*
          True jelly beans: wrap (no side-scroll). New members see every group + per-bean
          unread in one glance — the nav "8" is one tap away, not scroll-then-tap.
        */}
        <div className="flex flex-wrap content-start gap-1.5">
          {orderedThreads.length === 0 ? (
            <p className="px-1 text-xs text-[var(--muted)]">No threads yet.</p>
          ) : (
            orderedThreads.map((t) => {
              const count = unreadByThread[t.id] || 0;
              const active = t.id === activeId;
              const fullLabel = threadLabel(t);
              return (
                <button
                  key={t.id}
                  type="button"
                  title={count > 0 ? `${fullLabel} · ${count} unread` : fullLabel}
                  aria-label={count > 0 ? `${fullLabel}, ${count} unread` : fullLabel}
                  aria-pressed={active}
                  onClick={() => setActiveId(t.id)}
                  className={`inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-tight transition ${
                    active
                      ? "bg-accent/20 text-accent ring-1 ring-accent/50"
                      : count > 0
                        ? "bg-rose-500/15 text-[var(--text)] ring-1 ring-rose-400/45"
                        : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <span className="truncate">{beanLabel(t)}</span>
                  {count > 0 ? (
                    <span className="inline-flex h-4 min-w-[16px] shrink-0 items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[9px] font-bold text-white">
                      {count > 9 ? "9+" : count}
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="chat-thread-shell flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div
          className="flex min-h-[min(58dvh,480px)] flex-col lg:min-h-0"
          style={
            isDesktopChat
              ? { height: workspaceHeight }
              : { height: "min(68dvh, calc(100dvh - 12.5rem))" }
          }
        >
          <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            style={isDesktopChat ? { height: feedHeight, flex: "none" } : undefined}
          >
            {loading && visibleMessages.length === 0 && (
              <p className="shrink-0 border-b border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)]">
                Loading...
              </p>
            )}
            <ChatFeed
              thread={feedThread}
              messages={visibleMessages}
              viewerRole="member"
              viewerId={memberId}
              mediaAutoplay
              emptyLabel={
                activeReplyThread?.kind === "cohort"
                  ? "No community posts yet."
                  : "No messages from your coach yet."
              }
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
            <div className="shrink-0 border-t border-[var(--border)]">
              <ChatThreadReply
                threadId={replyThreadId}
                role={replyRole}
                threadKind={activeReplyThread?.kind}
                destinationLabel={replyDestination}
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
            </div>
          ) : null}
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

      {/* Soft tip entry — never mid-workout; gratitude moment near coach 1:1 */}
      {activeReplyThread?.kind === "member" && !asCoach ? (
        <p className="px-1 text-center text-[11px] text-[var(--muted)]">
          Grateful for coaching?{" "}
          <Link
            href="/member/account#tip-coach"
            className="font-medium text-accent hover:underline"
          >
            Tip Coach Jeremy
          </Link>{" "}
          (optional · Account)
        </p>
      ) : null}
    </div>
  );
}