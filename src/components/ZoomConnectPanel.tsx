"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type ZoomStatus = {
  oauthAppConfigured: boolean;
  s2sConfigured: boolean;
  connected: boolean;
  ready: boolean;
  sdkConfigured: boolean;
  sdkConfigHint: string | null;
  maxDurationMin: number;
  coachStartsFirst: boolean;
  account: { email: string; displayName: string; connectedAt: string } | null;
};

type Banner = {
  tone: "success" | "error" | "info";
  text: string;
};

function statusUrl(): string {
  return `/api/admin/zoom/status?_=${Date.now()}`;
}

export default function ZoomConnectPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<ZoomStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);

  const applyStatus = useCallback((data: ZoomStatus) => {
    setStatus({
      ...data,
      account: data.connected ? data.account : null,
      ready: data.connected && data.ready,
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(statusUrl(), { cache: "no-store" });
      const data = (await res.json()) as ZoomStatus;
      if (res.ok) applyStatus(data);
      else setBanner({ tone: "error", text: "Could not load Zoom status — refresh the page." });
    } catch {
      setBanner({ tone: "error", text: "Could not load Zoom status — check your connection." });
    } finally {
      setLoading(false);
    }
  }, [applyStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const zoom = searchParams.get("zoom");
    if (zoom === "connected") {
      setBanner({
        tone: "success",
        text: "Zoom connected — use Start Video on Go to Today when class begins.",
      });
      void load();
      router.replace("/admin/settings", { scroll: false });
    } else if (zoom === "error") {
      setBanner({ tone: "error", text: "Zoom connection failed — try Connect again." });
      router.replace("/admin/settings", { scroll: false });
    }
  }, [searchParams, load, router]);

  async function disconnect() {
    if (busy) return;
    setBusy(true);
    setBanner(null);

    const disconnected: ZoomStatus = {
      oauthAppConfigured: status?.oauthAppConfigured ?? true,
      s2sConfigured: status?.s2sConfigured ?? false,
      connected: false,
      ready: false,
      sdkConfigured: status?.sdkConfigured ?? true,
      sdkConfigHint: status?.sdkConfigHint ?? null,
      maxDurationMin: status?.maxDurationMin ?? 40,
      coachStartsFirst: true,
      account: null,
    };
    applyStatus(disconnected);

    try {
      const res = await fetch("/api/admin/zoom/disconnect", {
        method: "POST",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setBanner({ tone: "error", text: "Disconnect failed — try again." });
        await load();
        return;
      }
      applyStatus(data as ZoomStatus);
      if (data.connected) {
        setBanner({
          tone: "error",
          text: "Still connected on the server — wait a moment and tap Disconnect again.",
        });
      } else {
        setBanner({
          tone: "info",
          text: "Zoom disconnected. Tap Connect when you are ready to link your account again.",
        });
      }
    } catch {
      setBanner({ tone: "error", text: "Disconnect failed — try again." });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading && !status) {
    return <p className="text-sm text-[var(--muted)]">Loading Zoom settings…</p>;
  }

  if (!status) return null;

  const canConnect = status.oauthAppConfigured && !status.connected;
  const showServerOnly = !status.oauthAppConfigured && status.s2sConfigured && !status.connected;

  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2 className="text-lg font-semibold">Live Zoom rooms (free plan)</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Connect your free Zoom account once (Google sign-in works on Zoom&apos;s page). Sessions cap
          at {status.maxDurationMin} minutes. You start the room — members join after you&apos;re in.
        </p>
      </div>

      {banner ? (
        <p
          className={`text-sm ${
            banner.tone === "error"
              ? "text-red-300"
              : banner.tone === "success"
                ? "text-[var(--success)]"
                : "text-sky-200"
          }`}
          role="status"
        >
          {banner.text}
        </p>
      ) : null}

      {!status.oauthAppConfigured && !status.s2sConfigured ? (
        <p className="text-sm text-amber-200">
          Zoom is not configured on the server yet — contact support before connecting.
        </p>
      ) : null}

      {status.connected && status.account ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Connected</p>
          <p className="mt-1 font-medium">{status.account.displayName}</p>
          <p className="text-xs text-[var(--muted)]">{status.account.email}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Linked {new Date(status.account.connectedAt).toLocaleString()}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Not connected
          </p>
          <p className="mt-1 text-[var(--muted)]">
            Link your Zoom account to start live class video from Go to Today.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {status.connected ? (
          <>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
              {status.ready ? "Ready for class" : "Connected"}
            </span>
            <button
              type="button"
              className="btn-ghost px-3 py-1 text-xs"
              disabled={busy}
              onClick={() => void disconnect()}
            >
              {busy ? "Disconnecting…" : "Disconnect"}
            </button>
          </>
        ) : canConnect ? (
          <Link
            href="/api/admin/zoom/connect"
            className="btn-primary px-4 py-2 text-sm"
            onClick={() => setBanner(null)}
          >
            Connect Zoom account
          </Link>
        ) : showServerOnly ? (
          <span className="text-xs text-[var(--muted)]">
            Server credentials configured — no coach login needed.
          </span>
        ) : null}
      </div>

      {status.connected && status.sdkConfigured ? (
        <p className="text-xs text-[var(--muted)]">
          After changing Zoom app permissions in the Marketplace, disconnect and connect again so
          embedded video on Go to Today picks up new scopes.
        </p>
      ) : null}
    </section>
  );
}