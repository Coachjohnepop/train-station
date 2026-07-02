"use client";

import { useEffect, useState } from "react";

type LiveSession = {
  id: string;
  scheduledAt: string;
  durationMin: number;
  title: string;
  status: string;
  zoomUrl: string | null;
  canJoin: boolean;
  startsInMin: number | null;
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function startsLabel(min: number | null) {
  if (min === null) return null;
  if (min <= 0 && min > -60) return "Starting now";
  if (min > 0 && min <= 60) return `Starts in ${min} min`;
  if (min > 60) return `Starts in ${Math.round(min / 60)} hr`;
  return null;
}

export default function MemberLiveSessionsPanel({ canLive }: { canLive: boolean }) {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [zoomConfigured, setZoomConfigured] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canLive) {
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const res = await fetch("/api/member/live-sessions", { cache: "no-store" });
        const data = await res.json();
        if (res.ok) {
          setSessions(data.sessions || []);
          setZoomConfigured(Boolean(data.zoomConfigured));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [canLive]);

  if (!canLive) return null;

  if (loading) {
    return (
      <p className="mt-4 text-sm text-[var(--muted)]">Loading your live sessions…</p>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-[var(--border)] p-4 text-center text-sm text-[var(--muted)]">
        No upcoming live sessions scheduled yet.
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {!zoomConfigured ? (
        <p className="text-xs text-[var(--muted)]">
          Coach will send your Zoom link when the session is confirmed.
        </p>
      ) : null}
      {sessions.map((session) => {
        const hint = startsLabel(session.startsInMin);
        return (
          <div
            key={session.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{session.title}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{formatWhen(session.scheduledAt)}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {session.durationMin} min · {session.status}
                  {hint ? ` · ${hint}` : ""}
                </p>
              </div>
              {session.zoomUrl && session.canJoin ? (
                <a
                  href={session.zoomUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary shrink-0 px-4 py-2 text-sm"
                >
                  Join Zoom
                </a>
              ) : session.zoomUrl ? (
                <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs text-[var(--muted)]">
                  Link ready — opens 15 min before
                </span>
              ) : (
                <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs text-[var(--muted)]">
                  Awaiting Zoom link
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}