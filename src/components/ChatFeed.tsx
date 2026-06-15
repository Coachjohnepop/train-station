"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { youtubeEmbedUrl } from "@/lib/youtube";
import type { ChatMessage, ChatThread } from "@/lib/coach-chat";

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function MessageBubble({ message, viewerRole }: { message: ChatMessage; viewerRole: "coach" | "member" }) {
  const isCoach = message.authorRole === "coach";
  const align = isCoach ? "items-start" : "items-end";

  if (message.kind === "workout_update") {
    return (
      <div className={`flex flex-col ${align}`}>
        <div className="card max-w-md border-amber-500/40 bg-amber-500/10">
          <p className="text-[10px] uppercase tracking-wide text-amber-300 font-semibold">Workout override</p>
          <p className="mt-1 font-semibold">{message.workoutTitle || message.body}</p>
          {message.sessionDate && (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Scheduled for {new Date(`${message.sessionDate}T12:00:00`).toLocaleDateString(undefined, {
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
        <span className="mt-1 text-[10px] text-[var(--muted)]">{formatWhen(message.createdAt)}</span>
      </div>
    );
  }

  if (message.kind === "youtube" && message.mediaUrl) {
    const embed = youtubeEmbedUrl(message.mediaUrl);
    return (
      <div className={`flex flex-col ${align}`}>
        <div className="card max-w-md overflow-hidden p-0">
          {message.body && <p className="px-3 pt-3 text-sm">{message.body}</p>}
          {embed && (
            <div className="mt-2 aspect-video w-full max-w-md">
              <iframe
                src={embed}
                title="Coach video"
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </div>
        <span className="mt-1 text-[10px] text-[var(--muted)]">
          {message.authorName} · {formatWhen(message.createdAt)}
        </span>
      </div>
    );
  }

  if (message.kind === "video_upload" && message.mediaUrl) {
    return (
      <div className={`flex flex-col ${align}`}>
        <div className="card max-w-md overflow-hidden p-0">
          {message.body && <p className="px-3 pt-3 text-sm">{message.body}</p>}
          <video
            src={message.mediaUrl}
            controls
            playsInline
            className="mt-2 w-full max-w-md bg-black"
          />
          {message.videoDurationSec && (
            <p className="px-3 pb-2 text-[10px] text-[var(--muted)]">{message.videoDurationSec}s clip</p>
          )}
        </div>
        <span className="mt-1 text-[10px] text-[var(--muted)]">
          {message.authorName} · {formatWhen(message.createdAt)}
        </span>
      </div>
    );
  }

  if (message.kind === "member_sms") {
    return (
      <div className={`flex flex-col ${align}`}>
        <div className="card max-w-md border-emerald-500/30 bg-emerald-500/10 text-sm">
          <p className="text-[10px] font-semibold uppercase text-emerald-300">SMS reply</p>
          <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
        </div>
        <span className="mt-1 text-[10px] text-[var(--muted)]">
          {message.authorName} · {formatWhen(message.createdAt)}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${align}`}>
      <div
        className={`max-w-md rounded-lg px-3 py-2 text-sm ${
          isCoach ? "bg-[var(--surface-2)] border border-[var(--border)]" : "bg-accent/20 border border-accent/30"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.body}</p>
      </div>
      <span className="mt-1 text-[10px] text-[var(--muted)]">
        {message.authorName} · {formatWhen(message.createdAt)}
      </span>
    </div>
  );
}

export default function ChatFeed({
  thread,
  messages,
  viewerRole,
  emptyLabel = "No messages yet.",
}: {
  thread: ChatThread | null;
  messages: ChatMessage[];
  viewerRole: "coach" | "member";
  emptyLabel?: string;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant" as ScrollBehavior });
  }, [thread?.id, messages.length]);

  if (!thread) {
    return <div className="card text-sm text-[var(--muted)]">Select a conversation.</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">{thread.title}</h2>
          <p className="text-xs text-[var(--muted)]">
            {thread.kind === "cohort" ? "Program cohort feed" : "Direct coach thread"}
          </p>
        </div>
      </div>

      <div className="card min-h-[320px] max-h-[60vh] overflow-y-auto space-y-4 p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{emptyLabel}</p>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} viewerRole={viewerRole} />)
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}