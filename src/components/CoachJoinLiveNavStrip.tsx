"use client";

/**
 * Always-visible Zoom CTA in the Go to Today top bar (no scrolling required).
 * Always shows a start/join control — never disappears when OAuth is mid-setup.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { startLiveClassBackupPoll } from "@/lib/session-live-poll";
import { localTodayIso } from "@/lib/program-calendar";

type ZoomRoom = {
  hostUrl: string;
  joinUrl: string;
  openUrl?: string;
  openAs?: "host" | "participant";
  isHost?: boolean;
  hostCoachEmail?: string | null;
  topic?: string;
  demo?: boolean;
};

export default function CoachJoinLiveNavStrip() {
  const [ready, setReady] = useState<boolean | null>(null);
  const [connected, setConnected] = useState(false);
  const [wrongHost, setWrongHost] = useState(false);
  const [room, setRoom] = useState<ZoomRoom | null>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [hostStarted, setHostStarted] = useState(false);

  // Must match member live-zoom status (APP_TIMEZONE / America/Los_Angeles) — not UTC.
  const sessionDate = localTodayIso();

  const refresh = useCallback(async () => {
    try {
      const [statusRes, zoomRes] = await Promise.all([
        fetch("/api/admin/zoom/status", { cache: "no-store" }),
        fetch(`/api/admin/live-floor/zoom?date=${sessionDate}`, { cache: "no-store" }),
      ]);
      const s = statusRes.ok ? await statusRes.json() : null;
      const z = zoomRes.ok ? await zoomRes.json() : null;

      if (s) {
        setConnected(Boolean(s.connected));
        setWrongHost(Boolean(s.wrongHostAccount));
      }
      if (z?.zoom?.hostUrl || z?.zoom?.joinUrl) {
        setRoom({
          hostUrl: z.zoom.hostUrl,
          joinUrl: z.zoom.joinUrl,
          openUrl: z.zoom.openUrl || z.zoom.hostUrl || z.zoom.joinUrl,
          openAs: z.zoom.openAs,
          isHost: z.zoom.isHost,
          hostCoachEmail: z.zoom.hostCoachEmail,
          topic: z.zoom.topic,
          demo: z.zoom.demo,
        });
      }
      if (typeof z?.hostStarted === "boolean") setHostStarted(z.hostStarted);

      const statusReady = typeof s?.ready === "boolean" ? s.ready : null;
      const zoomReady = typeof z?.ready === "boolean" ? z.ready : null;
      // Stay ready if either API says ready so a flaky poll cannot swap
      // Join Live Now ↔ Sign in to Zoom.
      if (statusReady === true || zoomReady === true) setReady(true);
      else if (statusReady === false && zoomReady === false) setReady(false);
      else if (statusReady === false && zoomReady === null) setReady(false);
      else if (zoomReady === false && statusReady === null) setReady(false);
    } catch {
      /* ignore */
    }
  }, [sessionDate]);

  useEffect(() => {
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const onFocus = () => void refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    if (!hostStarted) return;
    return startLiveClassBackupPoll(() => {
      void refresh();
    });
  }, [hostStarted, refresh]);

  async function joinLiveNow() {
    setBusy(true);
    setHint(null);
    try {
      const res = await fetch("/api/admin/live-floor/zoom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionDate, startHost: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setHint(data.error || "Could not start Zoom.");
        return;
      }
      if (data.demo || !(data.zoom?.openUrl || data.zoom?.hostUrl || data.zoom?.joinUrl)) {
        setHint("Connect Zoom in Settings first (class host should be ready).");
        setReady(false);
        return;
      }
      const openUrl = (data.zoom.openUrl || data.zoom.hostUrl || data.zoom.joinUrl) as string;
      const asHost = data.zoom.openAs === "host" || data.zoom.isHost === true;
      setRoom({
        hostUrl: data.zoom.hostUrl,
        joinUrl: data.zoom.joinUrl,
        openUrl,
        openAs: asHost ? "host" : "participant",
        isHost: asHost,
        hostCoachEmail: data.zoom.hostCoachEmail,
        topic: data.zoom.topic,
      });
      if (typeof data.ready === "boolean") setReady(data.ready);
      if (asHost) {
        setHostStarted(true);
        if (data.notified > 0) {
          setHint(`Live as host — link sent to ${data.notified} member${data.notified === 1 ? "" : "s"}.`);
        } else {
          setHint("You're hosting — members can Join Live Zoom Now.");
        }
      } else {
        setHint("Joining as participant (host is the class coach). Enter as guest if Zoom asks to log in.");
      }
      window.open(openUrl, "_blank", "noopener,noreferrer");
    } catch {
      setHint("Could not open Zoom.");
    } finally {
      setBusy(false);
      setTimeout(() => setHint(null), 5000);
    }
  }

  async function endLiveForMembers() {
    setBusy(true);
    setHint(null);
    try {
      const res = await fetch("/api/admin/live-floor/zoom", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionDate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setHint((data as { error?: string }).error || "Could not end live flag.");
        return;
      }
      setHostStarted(false);
      setHint("Members no longer see Join Live Zoom.");
      void refresh();
    } catch {
      setHint("Could not end live flag.");
    } finally {
      setBusy(false);
      setTimeout(() => setHint(null), 4000);
    }
  }

  if (ready === null) {
    return (
      <span className="shrink-0 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-200/80">
        Zoom…
      </span>
    );
  }

  // Always show a primary start control. Connect is secondary when needed.
  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {!ready || wrongHost || !connected ? (
          <Link
            href="/admin/settings"
            className="btn-ghost min-h-[40px] px-2 py-1.5 text-[10px] font-semibold sm:min-h-[44px] sm:px-3 sm:text-xs"
            title="Link Zoom host account in Settings"
          >
            {wrongHost ? "Fix Zoom account" : connected ? "Zoom settings" : "Connect Zoom"}
          </Link>
        ) : null}
        {ready ? (
          <button
            type="button"
            className="btn-primary min-h-[40px] px-3 py-1.5 text-xs font-bold shadow-md shadow-sky-500/20 sm:min-h-[44px] sm:px-4 sm:text-sm"
            disabled={busy}
            onClick={() => void joinLiveNow()}
            title={
              room?.isHost === false
                ? "Open the class Zoom as a participant (host is Jeremy / class coach)"
                : "Create today's class room if needed and open Zoom as host"
            }
          >
            {busy
              ? "Opening…"
              : room?.isHost === false
                ? "Join class Zoom"
                : room?.openUrl || room?.hostUrl
                  ? "Join Live Now"
                  : "Start Live Zoom"}
          </button>
        ) : (
          <Link
            href="/admin/settings"
            className="btn-primary min-h-[40px] px-3 py-1.5 text-xs font-bold sm:min-h-[44px] sm:px-4 sm:text-sm"
            title="Connect Zoom so you can start class video"
          >
            Sign in to Zoom
          </Link>
        )}
      </div>
      {hostStarted && room?.isHost !== false ? (
        <button
          type="button"
          className="text-[10px] font-semibold text-amber-200/90 underline-offset-2 hover:underline disabled:opacity-50"
          disabled={busy}
          onClick={() => void endLiveForMembers()}
          title="Hide Join Live Zoom for members (class finished)"
        >
          End live for members
        </button>
      ) : null}
      {(room?.openUrl || room?.hostUrl || room?.joinUrl) && ready ? (
        <a
          href={room.openUrl || (room.isHost === false ? room.joinUrl : room.hostUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-semibold text-sky-200 underline-offset-2 hover:underline"
        >
          {room.isHost === false ? "Open join link ↗" : "Open host link ↗"}
        </a>
      ) : null}
      {hint ? (
        <p className="max-w-[14rem] text-right text-[9px] text-amber-200">{hint}</p>
      ) : wrongHost ? (
        <p className="max-w-[14rem] text-right text-[9px] text-amber-200">
          Wrong Zoom user — reconnect in Settings
        </p>
      ) : null}
    </div>
  );
}
