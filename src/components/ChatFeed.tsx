"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { youtubeEmbedUrl } from "@/lib/youtube";
import type { ChatMessage, ChatThread } from "@/lib/coach-chat";
import { bubbleColorsForMessage, messageKindLabel } from "@/lib/chat-colors";

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

function isOutgoing(authorRole: ChatMessage["authorRole"], viewerRole: "coach" | "member") {
  return authorRole === viewerRole;
}

function KindBadge({ kind }: { kind: ChatMessage["kind"] }) {
  const label = messageKindLabel(kind);
  if (!label) return null;
  const colors = bubbleColorsForMessage(kind, false, "coach");
  return (
    <span className={`mb-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${colors.badge} ${colors.badgeText}`}>
      {label}
    </span>
  );
}

function MessageMeta({
  message,
  outgoing,
  label,
}: {
  message: ChatMessage;
  outgoing: boolean;
  label?: string | null;
}) {
  return (
    <p className={`mt-0.5 px-0.5 text-[10px] text-[var(--muted)] ${outgoing ? "text-right" : "text-left"}`}>
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
      <p className="mt-1 font-medium">{message.workoutTitle || message.body}</p>
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
}: {
  message: ChatMessage;
  colors: ReturnType<typeof bubbleColorsForMessage>;
}) {
  const isYoutube = message.kind === "youtube" && message.mediaUrl;
  const embed = isYoutube ? youtubeEmbedUrl(message.mediaUrl!) : null;
  const isVideo = message.kind === "video_upload" && message.mediaUrl;

  return (
    <div className={`overflow-hidden rounded-2xl text-sm text-left ${colors.bubble} max-w-full`}>
      {message.body && <p className="px-3 pt-2.5 pb-1 whitespace-pre-wrap">{message.body}</p>}
      {embed && (
        <div className="aspect-video w-full bg-black">
          <iframe
            src={embed}
            title="Coach video"
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
      {isVideo && <video src={message.mediaUrl} controls playsInline className="w-full bg-black" />}
      {isVideo && message.videoDurationSec ? (
        <p className="px-3 py-1.5 text-[10px] text-[var(--muted)]">{message.videoDurationSec}s clip</p>
      ) : null}
    </div>
  );
}

function TextBubble({
  message,
  colors,
  outgoing,
}: {
  message: ChatMessage;
  colors: ReturnType<typeof bubbleColorsForMessage>;
  outgoing: boolean;
}) {
  return (
    <div
      className={`overflow-hidden text-sm text-left whitespace-pre-wrap leading-relaxed px-3 py-2 rounded-2xl ${
        outgoing ? "rounded-br-md" : "rounded-bl-md"
      } ${colors.bubble}`}
    >
      {message.body}
    </div>
  );
}

function MessageBubble({ message, viewerRole }: { message: ChatMessage; viewerRole: "coach" | "member" }) {
  const outgoing = isOutgoing(message.authorRole, viewerRole);
  const label = message.kind === "member_sms" ? "via SMS" : null;
  const isRich =
    message.kind === "workout_update" ||
    message.kind === "youtube" ||
    message.kind === "video_upload";
  const colors = bubbleColorsForMessage(message.kind, outgoing, viewerRole);

  return (
    <div className={`flex w-full ${outgoing ? "justify-end" : "justify-start"}`}>
      <div
        className={`flex max-w-[min(78%,22rem)] flex-col ${outgoing ? "items-end" : "items-start"} ${
          isRich ? "max-w-[min(88%,28rem)]" : ""
        }`}
      >
        {!outgoing && (
          <p className="mb-0.5 px-0.5 text-[10px] font-medium text-[var(--muted)]">
            {message.authorName}
            {label ? ` · ${label}` : ""}
          </p>
        )}
        {isRich && <KindBadge kind={message.kind} />}

        {message.kind === "workout_update" ? (
          <WorkoutUpdateBubble message={message} viewerRole={viewerRole} colors={colors} />
        ) : message.kind === "youtube" || message.kind === "video_upload" ? (
          <MediaBubble message={message} colors={colors} />
        ) : (
          <TextBubble message={message} colors={colors} outgoing={outgoing} />
        )}

        <MessageMeta message={message} outgoing={outgoing} label={outgoing ? label : null} />
      </div>
    </div>
  );
}

function FeedItem({ message, viewerRole }: { message: ChatMessage; viewerRole: "coach" | "member" }) {
  if (message.authorRole === "system") {
    return (
      <div className="flex justify-center py-1">
        <p className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-[10px] text-[var(--muted)]">
          {message.body}
        </p>
      </div>
    );
  }
  return <MessageBubble message={message} viewerRole={viewerRole} />;
}

export default function ChatFeed({
  thread,
  messages,
  viewerRole,
  emptyLabel = "No messages yet.",
  hideHeader = false,
  headerAccent,
}: {
  thread: ChatThread | null;
  messages: ChatMessage[];
  viewerRole: "coach" | "member";
  emptyLabel?: string;
  hideHeader?: boolean;
  headerAccent?: string;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

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

  const threadKindLabel = thread.kind === "cohort" ? "Community" : "Direct";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!hideHeader && (
        <div className={`shrink-0 border-b border-[var(--border)] px-4 py-2.5 ${headerAccent || ""}`}>
          <h2 className="text-sm font-semibold">{thread.title}</h2>
          <p className="text-[11px] text-[var(--muted)]">
            {thread.kind === "cohort" ? "Community feed" : "Direct messages with your coach"}
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
            {messages.map((m) => (
              <FeedItem key={m.id} message={m} viewerRole={viewerRole} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}