"use client";

import { useCallback, useEffect, useState } from "react";
import ZoomMeetingEmbedLazy from "@/components/ZoomMeetingEmbedLazy";
import type { ZoomEmbedCredentials } from "@/components/ZoomMeetingEmbed";

type ZoomSummary = {
  sessionDate: string;
  meetingNumber: string;
  joinUrl: string;
  hostUrl: string;
  topic: string;
  demo?: boolean;
};

function useDesktopEmbed() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return desktop;
}

export default function CoachLiveFloorZoomPanel({ sessionDate }: { sessionDate: string }) {
  const desktop = useDesktopEmbed();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [zoom, setZoom] = useState<ZoomSummary | null>(null);
  const [embedCreds, setEmbedCreds] = useState<ZoomEmbedCredentials | null>(null);
  const [embedVisible, setEmbedVisible] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/live-floor/zoom?date=${sessionDate}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.zoom) setZoom(data.zoom);
    } catch {
      /* ignore */
    }
  }, [sessionDate]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function ensureRoom() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/live-floor/zoom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionDate }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Could not create Zoom room.");
        return;
      }
      setZoom(data.zoom);
      setMessage(data.demo ? "Demo room ready — connect Zoom for real meetings." : "Live Zoom room ready.");
      setTimeout(() => setMessage(null), 4000);
    } catch {
      setMessage("Could not create Zoom room.");
    } finally {
      setBusy(false);
    }
  }

  async function startEmbedded() {
    if (!desktop) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/live-floor/zoom/credentials?date=${sessionDate}&ensure=1`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Could not start embedded Zoom.");
        return;
      }
      if (data.demo) {
        setZoom((prev) =>
          prev ?? {
            sessionDate,
            meetingNumber: data.meetingNumber,
            joinUrl: data.joinUrl,
            hostUrl: data.hostUrl,
            topic: `Train Station Live — ${sessionDate}`,
            demo: true,
          },
        );
        setMessage("Demo mode — use Start in Zoom app.");
        return;
      }
      setEmbedCreds({
        signature: data.signature,
        meetingNumber: data.meetingNumber,
        password: data.password,
        userName: data.userName,
        zak: data.zak,
        role: 1,
      });
      setEmbedVisible(true);
      setOpen(true);
    } catch {
      setMessage("Could not start embedded Zoom.");
    } finally {
      setBusy(false);
    }
  }

  function closeEmbed() {
    setEmbedVisible(false);
    setEmbedCreds(null);
  }

  return (
    <section className="rounded-2xl border border-sky-500/35 bg-sky-500/8 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-sky-200">Group video</p>
          <p className="text-xs text-[var(--muted)]">
            One Zoom room for today&apos;s live class. Desktop: embed here while you check sets. Phone: open Zoom app.
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost min-h-[44px] px-3 py-2 text-xs"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide video" : "Show video"}
        </button>
      </div>

      {message ? <p className="mt-2 text-xs text-[var(--success)]">{message}</p> : null}

      {open ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {!zoom ? (
              <button
                type="button"
                className="btn-primary min-h-[44px] px-4 py-2 text-sm"
                disabled={busy}
                onClick={() => void ensureRoom()}
              >
                {busy ? "Creating…" : "Create class Zoom room"}
              </button>
            ) : (
              <>
                {desktop ? (
                  <button
                    type="button"
                    className="btn-primary min-h-[44px] px-4 py-2 text-sm"
                    disabled={busy || embedVisible}
                    onClick={() => void startEmbedded()}
                  >
                    {busy ? "Starting…" : embedVisible ? "Video live" : "Start video here"}
                  </button>
                ) : null}
                {zoom.hostUrl ? (
                  <a
                    href={zoom.hostUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary min-h-[44px] px-4 py-2 text-sm"
                  >
                    {desktop ? "Open in Zoom app" : "Start Zoom"}
                  </a>
                ) : null}
                {zoom.joinUrl ? (
                  <button
                    type="button"
                    className="btn-ghost min-h-[44px] px-3 py-2 text-xs"
                    onClick={() => void navigator.clipboard.writeText(zoom.joinUrl)}
                  >
                    Copy member link
                  </button>
                ) : null}
                {embedVisible ? (
                  <button
                    type="button"
                    className="btn-ghost min-h-[44px] px-3 py-2 text-xs"
                    onClick={closeEmbed}
                  >
                    Leave video
                  </button>
                ) : null}
              </>
            )}
          </div>

          {!desktop ? (
            <p className="text-xs text-[var(--muted)]">
              On phone, use Start Zoom for the native app — Live Floor stays open for checkoffs.
            </p>
          ) : null}

          {desktop && embedVisible && embedCreds ? (
            <ZoomMeetingEmbedLazy
              credentials={embedCreds}
              height={400}
              onLeft={closeEmbed}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}