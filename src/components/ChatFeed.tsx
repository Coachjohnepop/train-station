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

function Avatar({ name, role }: { name: string; role: "coach" | "member" }) {
  const initial = (name || "?").charAt(0).toUpperCase();
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
        role === "coach" ? "bg-accent/25 text-accent ring-1 ring-accent/40" : "bg-[var(--surface-2)] text-[var(--muted)]"
      }`}
    >
      {initial}
    </div>
  );
}

function CoachPostCard({ message, viewerRole }: { message: ChatMessage; viewerRole: "coach" | "member" }) {
  if (message.kind === "workout_update") {
    return (
      <article className="overflow-hidden rounded-xl border border-amber-500/35 bg-[var(--surface)] shadow-sm">
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
          <Avatar name={message.authorName} role="coach" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm">{message.authorName}</p>
            <p className="text-[11px] text-[var(--muted)]">{formatWhen(message.createdAt)} · Workout update</p>
          </div>
        </div>
        <div className="space-y-3 px-4 py-4">
          <p className="font-semibold">{message.workoutTitle || message.body}</p>
          {message.sessionDate && (
            <p className="text-xs text-[var(--muted)]">
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
            className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
          >
            Open Go to Today →
          </Link>
        </div>
      </article>
    );
  }

  if (message.kind === "youtube" && message.mediaUrl) {
    const embed = youtubeEmbedUrl(message.mediaUrl);
    return (
      <article className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
          <Avatar name={message.authorName} role="coach" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm">{message.authorName}</p>
            <p className="text-[11px] text-[var(--muted)]">{formatWhen(message.createdAt)}</p>
          </div>
        </div>
        {message.body && <p className="px-4 pt-4 text-sm whitespace-pre-wrap">{message.body}</p>}
        {embed && (
          <div className="mt-3 aspect-video w-full bg-black">
            <iframe
              src={embed}
              title="Coach video"
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
      </article>
    );
  }

  if (message.kind === "video_upload" && message.mediaUrl) {
    return (
      <article className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
          <Avatar name={message.authorName} role="coach" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm">{message.authorName}</p>
            <p className="text-[11px] text-[var(--muted)]">
              {formatWhen(message.createdAt)}
              {message.videoDurationSec ? ` · ${message.videoDurationSec}s clip` : ""}
            </p>
          </div>
        </div>
        {message.body && <p className="px-4 pt-4 text-sm whitespace-pre-wrap">{message.body}</p>}
        <video src={message.mediaUrl} controls playsInline className="mt-3 w-full bg-black" />
      </article>
    );
  }

  return (
    <article className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
        <Avatar name={message.authorName} role="coach" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm">{message.authorName}</p>
          <p className="text-[11px] text-[var(--muted)]">{formatWhen(message.createdAt)}</p>
        </div>
      </div>
      {message.body && (
        <p className="px-4 py-4 text-sm leading-relaxed whitespace-pre-wrap">{message.body}</p>
      )}
    </article>
  );
}

function MemberReplyBubble({ message, viewerRole }: { message: ChatMessage; viewerRole: "coach" | "member" }) {
  const isOwn = viewerRole === "member";
  const label = message.kind === "member_sms" ? "via SMS" : null;

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[min(85%,28rem)] ${isOwn ? "text-right" : "text-left"}`}>
        <div
          className={`inline-block rounded-2xl px-4 py-2.5 text-sm text-left ${
            isOwn
              ? "rounded-br-md bg-accent/20 border border-accent/30"
              : "rounded-bl-md bg-emerald-500/10 border border-emerald-500/25"
          }`}
        >
          {!isOwn && (
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
              {message.authorName}
              {label ? ` · ${label}` : ""}
            </p>
          )}
          <p className="whitespace-pre-wrap">{message.body}</p>
        </div>
        <p className={`mt-1 text-[10px] text-[var(--muted)] ${isOwn ? "pr-1" : "pl-1"}`}>
          {formatWhen(message.createdAt)}
          {isOwn && label ? ` · ${label}` : ""}
        </p>
      </div>
    </div>
  );
}

function FeedItem({ message, viewerRole }: { message: ChatMessage; viewerRole: "coach" | "member" }) {
  if (message.authorRole === "coach") {
    return <CoachPostCard message={message} viewerRole={viewerRole} />;
  }
  return <MemberReplyBubble message={message} viewerRole={viewerRole} />;
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
        <div className="shrink-0 border-b border-[var(--border)] px-4 py-3">
          <h2 className="font-semibold">{thread.title}</h2>
          <p className="text-xs text-[var(--muted)]">
            {thread.kind === "cohort" ? "Community feed" : "Direct messages with your coach"}
          </p>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center">
            <p className="text-sm text-[var(--muted)]">{emptyLabel}</p>
            {viewerRole === "member" && (
              <p className="mt-2 max-w-xs text-xs text-[var(--muted)]">
                Coach posts, videos, and notes will show up here — like a Patreon creator feed.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-5">
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