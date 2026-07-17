"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import YoutubeAutoplayFrame from "@/components/YoutubeAutoplayFrame";
import type { ChatMessage, ChatReaction, ChatThread } from "@/lib/coach-chat";
import { bubbleColorsForMessage, messageKindLabel } from "@/lib/chat-colors";
import { linkifyText } from "@/lib/linkify-text";
import { COMMUNITY_NO_BROADCAST_NOTE } from "@/lib/community-feed";

const QUICK_REACTIONS = ["✅", "👍", "❤️", "🙌", "💪", "🔥"] as const;

function formatWhen(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / (1000 * 60 * 60);
  if (diffH < 24) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Coach always left; member / group always right. */
function isCoachSide(authorRole: ChatMessage["authorRole"]) {
  return authorRole === "coach";
}

function KindBadge({ kind, authorRole }: { kind: ChatMessage["kind"]; authorRole: ChatMessage["authorRole"] }) {
  const label = messageKindLabel(kind);
  if (!label) return null;
  const colors = bubbleColorsForMessage(kind, authorRole);
  return (
    <span className={`mb-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${colors.badge} ${colors.badgeText}`}>
      {label}
    </span>
  );
}

function UnreadBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#ff3b30] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
      <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
      New
    </span>
  );
}

function MessageMeta({
  message,
  onRight,
  label,
}: {
  message: ChatMessage;
  onRight: boolean;
  label?: string | null;
}) {
  return (
    <p className={`mt-0.5 px-0.5 text-[10px] text-[var(--muted)] ${onRight ? "text-right" : "text-left"}`}>
      {formatWhen(message.createdAt)}
      {label ? ` · ${label}` : ""}
    </p>
  );
}

function WorkoutUpdateBubble({
  message,
  viewerRole,
  colors,
}: {
  message: ChatMessage;
  viewerRole: "coach" | "member";
  colors: ReturnType<typeof bubbleColorsForMessage>;
}) {
  return (
    <div className={`overflow-hidden rounded-2xl text-sm text-left ${colors.bubble} px-3 py-2.5`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200">Workout update</p>
      <p className="mt-1 font-medium">
        {message.workoutTitle || linkifyText(message.body || "")}
      </p>
      {message.sessionDate && (
        <p className="mt-1 text-xs text-[var(--muted)]">
          Scheduled for{" "}
          {new Date(`${message.sessionDate}T12:00:00`).toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </p>
      )}
      <Link
        href={
          viewerRole === "coach"
            ? `/admin/today?date=${message.sessionDate}`
            : `/member/today?date=${message.sessionDate}`
        }
        className="mt-2 inline-block text-xs font-medium text-amber-200 hover:underline"
      >
        Open Go to Today →
      </Link>
    </div>
  );
}

function MediaBubble({
  message,
  colors,
  mediaAutoplay = false,
}: {
  message: ChatMessage;
  colors: ReturnType<typeof bubbleColorsForMessage>;
  mediaAutoplay?: boolean;
}) {
  const isYoutube = message.kind === "youtube" && message.mediaUrl;
  const isVideo = message.kind === "video_upload" && message.mediaUrl;
  const isImage = message.kind === "image" && message.mediaUrl;

  return (
    <div className={`overflow-hidden rounded-2xl text-sm text-left ${colors.bubble} max-w-full`}>
      {message.body && (
        <p className="px-3 pt-2.5 pb-1 whitespace-pre-wrap break-words">{linkifyText(message.body)}</p>
      )}
      {isImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={message.mediaUrl}
          alt={message.body || "Coach photo"}
          className="max-h-[480px] w-full object-contain bg-black/40"
          loading="lazy"
        />
      )}
      {isYoutube && (
        <div className="aspect-video w-full bg-black">
          <YoutubeAutoplayFrame
            videoUrl={message.mediaUrl!}
            title="Coach video"
            className="h-full w-full"
            autoplay={mediaAutoplay}
            kickPlayback={mediaAutoplay}
            duckBackgroundMusic={mediaAutoplay}
          />
        </div>
      )}
      {isVideo && (
        <video
          src={message.mediaUrl}
          controls
          playsInline
          autoPlay={mediaAutoplay}
          muted
          className="w-full bg-black"
        />
      )}
      {isVideo && message.videoDurationSec ? (
        <p className="px-3 py-1.5 text-[10px] text-[var(--muted)]">{message.videoDurationSec}s clip</p>
      ) : null}
    </div>
  );
}

function TextBubble({
  message,
  colors,
  onRight,
}: {
  message: ChatMessage;
  colors: ReturnType<typeof bubbleColorsForMessage>;
  onRight: boolean;
}) {
  return (
    <div
      className={`overflow-hidden text-sm text-left whitespace-pre-wrap leading-relaxed px-3 py-2 rounded-2xl ${
        onRight ? "rounded-br-md" : "rounded-bl-md"
      } ${colors.bubble} break-words`}
    >
      {linkifyText(message.body)}
    </div>
  );
}

function reactionGroups(reactions: ChatReaction[] = []) {
  const groups = new Map<string, number>();
  for (const r of reactions) {
    groups.set(r.emoji, (groups.get(r.emoji) || 0) + 1);
  }
  return groups;
}

function MessageReactions({
  message,
  viewerRole,
  viewerId,
  onToggle,
}: {
  message: ChatMessage;
  viewerRole: "coach" | "member";
  viewerId: string;
  onToggle: (messageId: string, emoji: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const reactions = message.reactions ?? [];
  const groups = reactionGroups(reactions);
  const mine = (emoji: string) => reactions.some((r) => r.emoji === emoji && r.userId === viewerId);

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1 px-0.5">
      {viewerRole === "coach" && (
        <>
          <button
            type="button"
            onClick={() => onToggle(message.id, "✅")}
            className={`rounded-full px-2 py-0.5 text-[11px] transition ${
              mine("✅")
                ? "bg-emerald-500/25 ring-1 ring-emerald-400/50"
                : "bg-[var(--surface-2)] text-[var(--muted)] hover:bg-[var(--surface-3)]"
            }`}
            title="Mark handled"
          >
            ✓ Done
          </button>
          <button
            type="button"
            onClick={() => onToggle(message.id, "👍")}
            className={`rounded-full px-2 py-0.5 text-[11px] transition ${
              mine("👍")
                ? "bg-violet-500/25 ring-1 ring-violet-400/50"
                : "bg-[var(--surface-2)] text-[var(--muted)] hover:bg-[var(--surface-3)]"
            }`}
            title="Like"
          >
            👍
          </button>
        </>
      )}

      {Array.from(groups.entries())
        .filter(([emoji]) => !(viewerRole === "coach" && (emoji === "✅" || emoji === "👍")))
        .map(([emoji, count]) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onToggle(message.id, emoji)}
          className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] transition ${
            mine(emoji)
              ? "bg-violet-500/25 ring-1 ring-violet-400/50"
              : "bg-[var(--surface-2)] hover:bg-[var(--surface-3)]"
          }`}
        >
          <span>{emoji}</span>
          {count > 1 && <span className="text-[10px] text-[var(--muted)]">{count}</span>}
        </button>
      ))}

      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] text-[var(--muted)] hover:bg-[var(--surface-3)]"
          aria-label="Add reaction"
        >
          {viewerRole === "coach" ? "✓ 👍 +" : "+"}
        </button>
        {pickerOpen && (
          <div className="absolute bottom-full left-0 z-10 mb-1 flex gap-0.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1 shadow-lg">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onToggle(message.id, emoji);
                  setPickerOpen(false);
                }}
                className={`rounded-full px-1.5 py-0.5 text-sm transition hover:bg-[var(--surface-2)] ${
                  mine(emoji) ? "bg-violet-500/20" : ""
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function isMessageUnreadForViewer(
  message: ChatMessage,
  viewerRole: "coach" | "member",
  viewerId: string,
): boolean {
  if (message.authorRole === "system") return false;
  // Only show NEW on the other party's messages
  if (viewerRole === "coach") {
    if (message.authorRole !== "member") return false;
    return !message.readByUserIds.includes(viewerId);
  }
  if (message.authorRole !== "coach") return false;
  return !message.readByUserIds.includes(viewerId);
}

function senderDisplayName(
  message: ChatMessage,
  threadKind: ChatThread["kind"] | undefined,
): string {
  const name = (message.authorName || "").trim();
  if (message.authorRole === "coach") {
    return name ? `${name} · Coach` : "Coach";
  }
  // Group / community: always show who posted (no generic "Member" only)
  if (threadKind === "cohort") {
    return name || "Member";
  }
  if (message.kind === "member_sms") {
    return name ? `${name} · SMS` : "via SMS";
  }
  return name || "Member";
}

function MessageBubble({
  message,
  viewerRole,
  viewerId,
  unread,
  onToggleReaction,
  mediaAutoplay = false,
  threadKind,
}: {
  message: ChatMessage;
  viewerRole: "coach" | "member";
  viewerId: string;
  unread?: boolean;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  mediaAutoplay?: boolean;
  threadKind?: ChatThread["kind"];
}) {
  // Coach always left; member/group always right (not viewer-relative).
  const onLeft = isCoachSide(message.authorRole);
  const onRight = !onLeft;
  const isGroup = threadKind === "cohort";
  const label = message.kind === "member_sms" && !isGroup ? "via SMS" : null;
  const sender = senderDisplayName(message, threadKind);
  const isRich =
    message.kind === "workout_update" ||
    message.kind === "youtube" ||
    message.kind === "video_upload" ||
    message.kind === "image";
  const colors = bubbleColorsForMessage(message.kind, message.authorRole);

  return (
    <div className={`flex w-full ${onRight ? "justify-end" : "justify-start"}`}>
      <div
        className={`flex max-w-[min(78%,22rem)] flex-col ${onRight ? "items-end" : "items-start"} ${
          isRich ? "max-w-[min(88%,28rem)]" : ""
        }`}
      >
        <div className={`mb-0.5 flex flex-wrap items-center gap-1.5 px-0.5 ${onRight ? "justify-end" : "justify-start"}`}>
          <p
            className={`text-[11px] font-semibold ${
              isGroup && message.authorRole !== "coach"
                ? "text-[var(--text)]"
                : "text-[var(--muted)]"
            }`}
          >
            {sender}
            {label ? ` · ${label}` : ""}
          </p>
          {unread ? <UnreadBadge /> : null}
        </div>
        {isRich && <KindBadge kind={message.kind} authorRole={message.authorRole} />}

        <div className={unread ? "rounded-2xl ring-2 ring-[#ff3b30]/50 ring-offset-1 ring-offset-[var(--surface)]" : undefined}>
          {message.kind === "workout_update" ? (
            <WorkoutUpdateBubble message={message} viewerRole={viewerRole} colors={colors} />
          ) : message.kind === "youtube" || message.kind === "video_upload" || message.kind === "image" ? (
            <MediaBubble message={message} colors={colors} mediaAutoplay={mediaAutoplay} />
          ) : (
            <TextBubble message={message} colors={colors} onRight={onRight} />
          )}
        </div>

        <MessageMeta message={message} onRight={onRight} label={onRight ? label : null} />
        {onToggleReaction && message.authorRole !== "system" && (
          <MessageReactions
            message={message}
            viewerRole={viewerRole}
            viewerId={viewerId}
            onToggle={onToggleReaction}
          />
        )}
      </div>
    </div>
  );
}

function FeedItem({
  message,
  viewerRole,
  viewerId,
  unread,
  onToggleReaction,
  mediaAutoplay = false,
  threadKind,
}: {
  message: ChatMessage;
  viewerRole: "coach" | "member";
  viewerId: string;
  unread?: boolean;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  mediaAutoplay?: boolean;
  threadKind?: ChatThread["kind"];
}) {
  if (message.authorRole === "system") {
    return (
      <div className="flex justify-center py-1">
        <p className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-[10px] text-[var(--muted)] break-words">
          {linkifyText(message.body)}
        </p>
      </div>
    );
  }
  return (
    <MessageBubble
      message={message}
      viewerRole={viewerRole}
      viewerId={viewerId}
      unread={unread}
      onToggleReaction={onToggleReaction}
      mediaAutoplay={mediaAutoplay}
      threadKind={threadKind}
    />
  );
}

export default function ChatFeed({
  thread,
  messages,
  viewerRole,
  viewerId = viewerRole === "coach" ? "coach" : "member",
  emptyLabel = "No messages yet.",
  hideHeader = false,
  headerAccent,
  onReactionChange,
  mediaAutoplay = false,
}: {
  thread: ChatThread | null;
  messages: ChatMessage[];
  viewerRole: "coach" | "member";
  viewerId?: string;
  emptyLabel?: string;
  hideHeader?: boolean;
  headerAccent?: string;
  onReactionChange?: (message: ChatMessage) => void;
  /** Off in admin chat; on for member-facing surfaces. */
  mediaAutoplay?: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  async function toggleReaction(messageId: string, emoji: string) {
    const res = await fetch("/api/chat/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, emoji, role: viewerRole }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.message) onReactionChange?.(data.message);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.id, messages.length]);

  if (!thread) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-[var(--muted)]">
        <p>Select a conversation from the inbox.</p>
      </div>
    );
  }

  const threadKindLabel = thread.kind === "cohort" ? "Group" : "Coach";
  const unreadFlags = messages.map((m) => isMessageUnreadForViewer(m, viewerRole, viewerId));
  const unreadCount = unreadFlags.filter(Boolean).length;
  const firstUnreadIndex = unreadFlags.findIndex(Boolean);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!hideHeader && (
        <div className={`shrink-0 border-b border-[var(--border)] px-4 py-2.5 ${headerAccent || ""}`}>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">{thread.title}</h2>
            {unreadCount > 0 && (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#ff3b30] px-1.5 text-[10px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--muted)]">
            {thread.kind === "cohort"
              ? `Group feed · names on every post · ${COMMUNITY_NO_BROADCAST_NOTE}`
              : "Direct messages with your coach"}
            {" · "}
            <span className="text-[var(--muted)]">Coach left · you / group right</span>
          </p>
        </div>
      )}

      {hideHeader && unreadCount > 0 && (
        <div className="shrink-0 border-b border-rose-500/30 bg-rose-500/10 px-4 py-2">
          <p className="flex items-center gap-2 text-xs font-semibold text-rose-100">
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#ff3b30] px-1.5 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
            Unread in this thread
          </p>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[160px] flex-col items-center justify-center text-center">
            <p className="text-sm text-[var(--muted)]">{emptyLabel}</p>
            {viewerRole === "member" && (
              <p className="mt-2 max-w-xs text-xs text-[var(--muted)]">
                Coach posts, videos, and notes will show up here.
              </p>
            )}
            {viewerRole === "coach" && (
              <p className="mt-2 max-w-xs text-xs text-[var(--muted)]">
                {threadKindLabel} thread · send a quick reply below or post from the composer.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((m, index) => (
              <div key={m.id}>
                {index === firstUnreadIndex && (
                  <div className="my-3 flex items-center gap-2 px-1" role="separator" aria-label="Unread messages">
                    <div className="h-px flex-1 bg-rose-500/50" />
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#ff3b30] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
                      {unreadCount} unread
                    </span>
                    <div className="h-px flex-1 bg-rose-500/50" />
                  </div>
                )}
                <FeedItem
                  message={m}
                  viewerRole={viewerRole}
                  viewerId={viewerId}
                  unread={unreadFlags[index]}
                  onToggleReaction={toggleReaction}
                  mediaAutoplay={mediaAutoplay}
                  threadKind={thread.kind}
                />
              </div>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
