"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type ZoomStatus = {
  oauthAppConfigured: boolean;
  s2sConfigured: boolean;
  connected: boolean;
  ready: boolean;
  maxDurationMin: number;
  coachStartsFirst: boolean;
  account: { email: string; displayName: string; connectedAt: string } | null;
};

export default function ZoomConnectPanel() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<ZoomStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/zoom/status", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setStatus(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const zoom = searchParams.get("zoom");
    if (zoom === "connected") setMessage("Zoom connected — you can start live rooms from My Class or Bookings.");
    if (zoom === "error") setMessage("Zoom connection failed — try again.");
  }, [searchParams]);

  async function disconnect() {
    setBusy(true);
    await fetch("/api/admin/zoom/disconnect", { method: "POST" });
    await load();
    setMessage("Zoom disconnected.");
    setBusy(false);
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Loading Zoom settings…</p>;
  }

  if (!status) return null;

  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2 className="text-lg font-semibold">Live Zoom rooms (free plan)</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Connect your free Zoom account once (Google sign-in works on Zoom&apos;s page). Sessions cap
          at {status.maxDurationMin} minutes. You start the room — members join after you&apos;re in.
        </p>
      </div>

      {message ? <p className="text-sm text-[var(--success)]">{message}</p> : null}

      {!status.oauthAppConfigured && !status.s2sConfigured ? (
        <p className="text-sm text-amber-200">
          Add <code className="text-xs">ZOOM_CLIENT_ID</code> and{" "}
          <code className="text-xs">ZOOM_CLIENT_SECRET</code> in Vercel (General OAuth app at
          marketplace.zoom.us), then connect below.
        </p>
      ) : null}

      {status.connected && status.account ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm">
          <p className="font-medium">{status.account.displayName}</p>
          <p className="text-xs text-[var(--muted)]">{status.account.email}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Connected {new Date(status.account.connectedAt).toLocaleString()}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {status.connected ? (
          <>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
              Zoom ready
            </span>
            <button
              type="button"
              className="btn-ghost px-3 py-1 text-xs"
              disabled={busy}
              onClick={() => void disconnect()}
            >
              Disconnect
            </button>
          </>
        ) : status.oauthAppConfigured ? (
          <a href="/api/admin/zoom/connect" className="btn-primary px-4 py-2 text-sm">
            Connect Zoom account
          </a>
        ) : status.s2sConfigured ? (
          <span className="text-xs text-[var(--muted)]">Server credentials configured — no coach login needed.</span>
        ) : null}
      </div>
    </section>
  );
}