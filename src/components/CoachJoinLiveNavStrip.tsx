"use client";

/**
 * Always-visible Zoom CTA in the Go to Today top bar (no scrolling required).
 * States: Connect Zoom (settings) | Join Live Now (create/start room).
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ZoomRoom = {
  hostUrl: string;
  joinUrl: string;
  topic?: string;
  demo?: boolean;
};

export default function CoachJoinLiveNavStrip() {
  const [ready, setReady] = useState<boolean | null>(null);
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState<ZoomRoom | null>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const sessionDate = new Date().toISOString().slice(0, 10);

  const refresh = useCallback(async () => {
    try {
      const [statusRes, zoomRes] = await Promise.all([
        fetch("/api/admin/zoom/status", { cache: "no-store" }),
        fetch(`/api/admin/live-floor/zoom?date=${sessionDate}`, { cache: "no-store" }),
      ]);
      if (statusRes.ok) {
        const s = await statusRes.json();
        setReady(Boolean(s.ready));
        setConnected(Boolean(s.connected));
      }
      if (zoomRes.ok) {
        const z = await zoomRes.json();
        if (z.zoom?.hostUrl) {
          setRoom({
            hostUrl: z.zoom.hostUrl,
            joinUrl: z.zoom.joinUrl,
            topic: z.zoom.topic,
            demo: z.zoom.demo,
          });
        }
        if (typeof z.ready === "boolean") setReady(z.ready);
      }
    } catch {
      /* ignore */
    }
  }, [sessionDate]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  async function joinLiveNow() {
    setBusy(true);
    setHint(null);
    try {
      let hostUrl = room?.hostUrl;
      if (!hostUrl) {
        const res = await fetch("/api/admin/live-floor/zoom", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionDate }),
        });
        const data = await res.json();
        if (!res.ok) {
          setHint(data.error || "Could not start Zoom.");
          return;
        }
        if (data.demo || !data.zoom?.hostUrl) {
          setHint("Connect Zoom in Settings first.");
          setReady(false);
          return;
        }
        hostUrl = data.zoom.hostUrl as string;
        setRoom({
          hostUrl,
          joinUrl: data.zoom.joinUrl,
          topic: data.zoom.topic,
        });
        if (data.notified > 0) {
          setHint(`Live — link sent to ${data.notified} member${data.notified === 1 ? "" : "s"}.`);
        }
      }
      if (hostUrl) {
        window.open(hostUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      setHint("Could not open Zoom.");
    } finally {
      setBusy(false);
      setTimeout(() => setHint(null), 5000);
    }
  }

  // Still loading status
  if (ready === null) {
    return (
      <span className="shrink-0 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-200/80">
        Zoom…
      </span>
    );
  }

  if (!ready) {
    return (
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <Link
          href="/admin/settings"
          className="btn-primary min-h-[40px] px-3 py-1.5 text-xs font-bold sm:min-h-[44px] sm:px-4 sm:text-sm"
          title="Connect your Zoom account"
        >
          {connected ? "Finish Zoom setup" : "Sign in to Zoom"}
        </Link>
        {hint ? <p className="max-w-[10rem] text-right text-[9px] text-amber-200">{hint}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5">
      <button
        type="button"
        className="btn-primary min-h-[40px] px-3 py-1.5 text-xs font-bold shadow-md shadow-sky-500/20 sm:min-h-[44px] sm:px-4 sm:text-sm"
        disabled={busy}
        onClick={() => void joinLiveNow()}
        title="Create today's class room (if needed) and open Zoom as host"
      >
        {busy ? "Starting…" : room?.hostUrl ? "Join Live Now" : "Join Live Now"}
      </button>
      {hint ? (
        <p className="max-w-[12rem] text-right text-[9px] text-emerald-200/90">{hint}</p>
      ) : (
        <p className="hidden text-[9px] text-sky-200/70 sm:block">No scroll — starts Zoom</p>
      )}
    </div>
  );
}
