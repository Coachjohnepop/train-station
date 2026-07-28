"use client";

import { useCallback, useEffect, useState } from "react";
import ZoomMeetingEmbedLazy from "@/components/ZoomMeetingEmbedLazy";
import type { ZoomEmbedCredentials } from "@/components/ZoomMeetingEmbed";
import { markZoomJoined } from "@/lib/member-zoom-join-ui";
import { useDesktopEmbed } from "@/lib/use-desktop-embed";

export default function MemberLiveZoomEmbed({
  sessionDate,
  canJoin,
}: {
  sessionDate: string;
  canJoin: boolean;
}) {
  const desktop = useDesktopEmbed();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [embedCreds, setEmbedCreds] = useState<ZoomEmbedCredentials | null>(null);
  const [embedVisible, setEmbedVisible] = useState(false);

  const loadJoinUrl = useCallback(async () => {
    try {
      const res = await fetch(`/api/member/live-zoom/credentials?date=${sessionDate}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok && data.joinUrl) setJoinUrl(data.joinUrl);
    } catch {
      /* ignore */
    }
  }, [sessionDate]);

  useEffect(() => {
    if (canJoin) void loadJoinUrl();
  }, [canJoin, loadJoinUrl]);

  async function joinEmbedded() {
    if (!desktop || !canJoin) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/member/live-zoom/credentials?date=${sessionDate}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Coach has not started the room yet.");
        return;
      }
      if (data.demo || !data.signature) {
        setJoinUrl(data.joinUrl || null);
        setMessage("Open Zoom app to join.");
        return;
      }
      setEmbedCreds({
        signature: data.signature,
        meetingNumber: data.meetingNumber,
        password: data.password,
        userName: data.userName,
        userEmail: data.userEmail,
        role: 0,
        speakerView: true,
      });
      setEmbedVisible(true);
      markZoomJoined(sessionDate);
    } catch {
      setMessage("Could not join embedded Zoom.");
    } finally {
      setBusy(false);
    }
  }

  function closeEmbed() {
    setEmbedVisible(false);
    setEmbedCreds(null);
  }

  if (!canJoin) return null;

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-sky-500/30 bg-sky-500/6 p-4">
      <p className="text-sm font-semibold text-sky-200">Class video</p>
      <p className="text-xs text-[var(--muted)]">
        Watch your coach on the big screen (desktop) or join in the Zoom app (phone).
      </p>

      {message ? <p className="text-xs text-[var(--muted)]">{message}</p> : null}

      <div className="flex flex-wrap gap-2">
        {desktop ? (
          <button
            type="button"
            className="btn-primary px-4 py-2 text-sm"
            disabled={busy || embedVisible}
            onClick={() => void joinEmbedded()}
          >
            {busy ? "Joining…" : embedVisible ? "In class video" : "Join video here"}
          </button>
        ) : null}
        {joinUrl ? (
          <a
            href={joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary px-4 py-2 text-sm"
            onClick={() => markZoomJoined(sessionDate)}
          >
            {desktop ? "Join in Zoom app" : "Join Zoom"}
          </a>
        ) : (
          <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs text-[var(--muted)]">
            Waiting for coach to start
          </span>
        )}
        {embedVisible ? (
          <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={closeEmbed}>
            Leave video
          </button>
        ) : null}
      </div>

      {desktop && embedVisible && embedCreds ? (
        <ZoomMeetingEmbedLazy credentials={embedCreds} height={360} onLeft={closeEmbed} />
      ) : null}
    </div>
  );
}