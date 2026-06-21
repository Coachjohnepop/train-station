"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { youtubeEmbedUrl } from "@/lib/youtube";
import type { ChatMessage, ChatThread } from "@/lib/coach-chat";

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

function bubbleShell(outgoing: boolean, className = "") {
  return `overflow-hidden text-sm text-left ${
    outgoing
      ? "rounded-2xl rounded-br-md bg-accent/25 text-[var(--foreground)]"
      : "rounded-2xl rounded-bl-md bg-[var(--surface-2)] text-[var(--foreground)]"
  } ${className}`;
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
  outgoing,
}: {
  message: ChatMessage;
  viewerRole: "coach" | "member";
  outgoing: boolean;
}) {
  return (
    <div className={bubbleShell(outgoing, "border border-amber-500/30 px-3 py-2.5")}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-400/90">Workout update</p>
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
        className="mt-2 inline-block text-xs text-accent hover:underline"
      >
        Open Go to Today →
      </Link>
    </div>
  );
}

function MediaBubble({
  message,
  outgoing,
}: {
  message: ChatMessage;
  outgoing: boolean;
}) {
  const isYoutube = message.kind === "youtube" && message.mediaUrl;
  const embed = isYoutube ? youtubeEmbedUrl(message.mediaUrl!) : null;
  const isVideo = message.kind === "video_upload" && message.mediaUrl;

  return (
    <div className={bubbleShell(outgoing, "max-w-full")}>
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
      {isVideo && (
        <video src={message.mediaUrl} controls playsInline className="w-full bg-black" />
      )}
      {isVideo && message.videoDurationSec ? (
        <p className="px-3 py-1.5 text-[10px] text-[var(--muted)]">{message.videoDurationSec}s clip</p>
      ) : null}
    </div>
  );
}

function TextBubble({ message, outgoing }: { message: ChatMessage; outgoing: boolean }) {
  return (
    <div className={bubbleShell(outgoing, "px-3 py-2 whitespace-pre-wrap leading-relaxed")}>
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

        {message.kind === "workout_update" ? (
          <WorkoutUpdateBubble message={message} viewerRole={viewerRole} outgoing={outgoing} />
        ) : message.kind === "youtube" || message.kind === "video_upload" ? (
          <MediaBubble message={message} outgoing={outgoing} />
        ) : (
          <TextBubble message={message} outgoing={outgoing} />
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
}: {
  thread: ChatThread | null;
  messages: ChatMessage[];
  viewerRole: "coach" | "member";
  emptyLabel?: string;
  hideHeader?: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.id, messages.length]);

  if (!thread) {
    return <div className="flex flex-1 items-center justify-center p-8 text-sm text-[var(--muted)]">Select a conversation.</div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!hideHeader && (
        <div className="shrink-0 border-b border-[var(--border)] px-4 py-2.5">
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
          </div>
        ) : (
          <div className="space-y-1.5">
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