"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ChatFeed from "@/components/ChatFeed";
import ChatThreadReply from "@/components/ChatThreadReply";
import type { ChatMessage, ChatThread } from "@/lib/coach-chat";
import { applyChatMessageLoad } from "@/lib/chat-message-merge";
import { DEMO_COACH } from "@/lib/demo-coach";
import {
  ChatResizeDivider,
  useDesktopChatLayout,
  useStoredPanelSize,
} from "@/lib/chat-panel-resize";

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

  const tabStorageKey = `ts-member-chat-tab:${memberId}`;

  const [threads, setThreads] = useState(orderedInitial);
  const [activeId, setActiveId] = useState(
    defaultCommunity?.id || defaultDirect?.id || orderedInitial[0]?.id || "",
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
  const replyPlaceholder =
    activeReplyThread?.kind === "cohort"
      ? "Comment on this post..."
      : "Message your coach...";
  const replyDestination =
    activeReplyThread?.kind === "cohort"
      ? "Posting to · Community feed"
      : "Posting to · Direct message with coach";

  return (
    <div className="space-y-4">
      {orderedThreads.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {orderedThreads.map((t) => {
            const count = unreadByThread[t.id] || 0;
            return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveId(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition ${
                t.id === activeId
                  ? "bg-accent/20 text-accent ring-1 ring-accent/50"
                  : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {threadLabel(t)}
              {count > 0 && (
                <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[9px] font-bold text-white">
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </button>
            );
          })}
        </div>
      )}

      <div className="chat-thread-shell flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div
          className="flex min-h-[520px] flex-col lg:min-h-0"
          style={isDesktopChat ? { height: workspaceHeight } : undefined}
        >
          <div
            className="flex min-h-0 flex-col overflow-hidden lg:shrink-0"
            style={isDesktopChat ? { height: feedHeight } : undefined}
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
            <div className="shrink-0">
              <ChatThreadReply
                threadId={replyThreadId}
                role="member"
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
    </div>
  );
}