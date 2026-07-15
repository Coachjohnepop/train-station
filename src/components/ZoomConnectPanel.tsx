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
  coachEmail?: string;
  requiredHostEmail?: string;
  wrongHostAccount?: boolean;
  account: {
    email: string;
    displayName: string;
    connectedAt: string;
    connectedByEmail?: string;
  } | null;
};

type Banner = {
  tone: "success" | "error" | "info";
  text: string;
};

function statusUrl(): string {
  return `/api/admin/zoom/status?_=${Date.now()}`;
}

function emailsDiffer(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() !== b.trim().toLowerCase();
}

export default function ZoomConnectPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<ZoomStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [zoomLogoutDone, setZoomLogoutDone] = useState(false);

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
    const reason = searchParams.get("reason") || "";
    const detail = searchParams.get("detail") || "";
    const warn = searchParams.get("warn") || "";

    if (zoom === "connected") {
      setBanner({
        tone: "success",
        text:
          warn === "save"
            ? "Zoom authorized, but saving the link hit a snag — try Connect once more. If it persists, contact support."
            : "Zoom connected — use Start Video on Go to Today when class begins. Recordings save to this Zoom account.",
      });
      setManageOpen(false);
      setZoomLogoutDone(false);
      void load();
      router.replace("/admin/settings", { scroll: false });
      return;
    }

    if (zoom === "error") {
      const messages: Record<string, string> = {
        scope:
          "Zoom needs the user:read:token scope — in marketplace.zoom.us open your app → Scopes, add it, save, then Connect again.",
        state:
          "Connection timed out or Connect was clicked more than once — stay signed in, tap Connect once, then approve on Zoom immediately.",
        session: "Your coach session expired — sign in again, then Connect Zoom.",
        denied: "Zoom authorization was cancelled or denied — tap Connect when you are ready.",
        redirect:
          "Redirect URL mismatch — in Zoom app settings, OAuth redirect must be https://www.thetrainstation.co/api/admin/zoom/callback",
        exchange: "Zoom token exchange failed — confirm Client ID/Secret in Vercel match your Zoom app.",
        missing_code: "Zoom did not return an authorization code — try Connect again.",
        wrong_host:
          "Wrong Zoom user. Live class must use jeremy@thetrainstation.co so recordings save on Jeremy’s account. Sign out of Zoom completely, then Connect again while signed into that Zoom.",
      };
      const base = messages[reason] || "Zoom connection failed — try Connect again.";
      setBanner({
        tone: "error",
        text:
          detail && (reason === "exchange" || reason === "scope" || reason === "wrong_host")
            ? `${base}${detail ? ` (${detail})` : ""}`
            : base,
      });
      setManageOpen(true);
      router.replace("/admin/settings", { scroll: false });
    }
  }, [searchParams, load, router]);

  async function disconnect(opts?: { openManage?: boolean }) {
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
      coachEmail: status?.coachEmail,
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
        if (opts?.openManage) {
          setManageOpen(true);
          setZoomLogoutDone(false);
          setBanner({
            tone: "info",
            text: "Train Station unlinked Zoom. Next: sign out of Zoom in your browser, then connect YOUR account.",
          });
        } else {
          setBanner({
            tone: "info",
            text: "Zoom disconnected. Tap Connect when you are ready to link your account again.",
          });
        }
      }
    } catch {
      setBanner({ tone: "error", text: "Disconnect failed — try again." });
      await load();
    } finally {
      setBusy(false);
    }
  }

  function openManage() {
    setManageOpen(true);
    setZoomLogoutDone(false);
    setBanner(null);
  }

  function openZoomLogout() {
    // Zoom OAuth reuses the browser session — must sign out of zoom.us or the
    // previous account is auto-approved again (e.g. coach keeps getting John's Zoom).
    window.open("https://zoom.us/logout", "_blank", "noopener,noreferrer");
    setZoomLogoutDone(true);
    setBanner({
      tone: "info",
      text: "Zoom logout opened in a new tab. When you see Zoom’s signed-out page, come back here and tap Connect my Zoom.",
    });
  }

  if (loading && !status) {
    return <p className="text-sm text-[var(--muted)]">Loading Zoom settings…</p>;
  }

  if (!status) return null;

  const canConnect = status.oauthAppConfigured && !status.connected;
  const showServerOnly = !status.oauthAppConfigured && status.s2sConfigured && !status.connected;
  const coachEmail = status.coachEmail || "";
  const requiredHost =
    status.requiredHostEmail || "jeremy@thetrainstation.co";
  const linkedEmail = status.account?.email || "";
  const wrongHost = Boolean(status.wrongHostAccount) ||
    (status.connected &&
      Boolean(linkedEmail) &&
      emailsDiffer(linkedEmail, requiredHost));
  const wrongAccount =
    wrongHost ||
    (status.connected &&
      Boolean(linkedEmail) &&
      Boolean(coachEmail) &&
      emailsDiffer(linkedEmail, coachEmail));

  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2 className="text-lg font-semibold">Live Zoom rooms (free plan)</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Live class must host as <strong>{requiredHost}</strong> so recordings save on Jeremy&apos;s
          Zoom / laptop. Sessions cap at {status.maxDurationMin} minutes. Coach starts the room —
          members join after. Google sign-in on Zoom&apos;s page is fine as long as that Zoom user
          is {requiredHost}.
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
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            wrongAccount
              ? "border-amber-500/40 bg-amber-500/10"
              : "border-emerald-500/30 bg-emerald-500/10"
          }`}
        >
          <p
            className={`text-xs font-semibold uppercase tracking-wider ${
              wrongAccount ? "text-amber-200" : "text-emerald-300"
            }`}
          >
            {wrongHost
              ? "Connected — wrong Zoom host"
              : wrongAccount
                ? "Connected — different Zoom account"
                : "Connected"}
          </p>
          <p className="mt-1 font-medium">{status.account.displayName}</p>
          <p className="text-xs text-[var(--muted)]">{status.account.email}</p>
          {status.account.connectedByEmail ? (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Linked by {status.account.connectedByEmail}
              {status.account.connectedAt
                ? ` · ${new Date(status.account.connectedAt).toLocaleString()}`
                : ""}
            </p>
          ) : (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Linked {new Date(status.account.connectedAt).toLocaleString()}
            </p>
          )}
          {wrongHost ? (
            <p className="mt-2 text-xs text-amber-100">
              Required host is <strong>{requiredHost}</strong>, but Zoom is linked as{" "}
              <strong>{linkedEmail}</strong>. Class will not treat this as ready until you switch.
              Use <strong>Manage Zoom account</strong> — sign out of Zoom, then connect as{" "}
              {requiredHost}.
            </p>
          ) : wrongAccount ? (
            <p className="mt-2 text-xs text-amber-100">
              You&apos;re signed in as <strong>{coachEmail}</strong>, but class video is using{" "}
              <strong>{linkedEmail}</strong>. Recordings will go to that Zoom user&apos;s account /
              laptop — not necessarily yours. Use <strong>Manage Zoom account</strong> below to
              switch.
            </p>
          ) : (
            <p className="mt-2 text-xs text-[var(--muted)]">
              Recordings for live class save under this Zoom login ({requiredHost}).
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Not connected
          </p>
          <p className="mt-1 text-[var(--muted)]">
            Link Zoom as <strong>{requiredHost}</strong> to start live class from Go to Today.
            Recordings will save on that Zoom account / host laptop.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {status.connected ? (
          <>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                wrongAccount
                  ? "bg-amber-500/15 text-amber-200"
                  : "bg-emerald-500/15 text-emerald-300"
              }`}
            >
              {wrongAccount ? "Wrong Zoom for this coach?" : status.ready ? "Ready for class" : "Connected"}
            </span>
            <button
              type="button"
              className="btn-primary px-4 py-2 text-sm"
              disabled={busy}
              onClick={openManage}
            >
              Manage Zoom account
            </button>
            <button
              type="button"
              className="btn-ghost px-3 py-1 text-xs"
              disabled={busy}
              onClick={() => void disconnect()}
            >
              {busy ? "Disconnecting…" : "Disconnect only"}
            </button>
          </>
        ) : canConnect ? (
          <>
            <button
              type="button"
              className="btn-primary px-4 py-2 text-sm"
              disabled={busy}
              onClick={openManage}
            >
              Manage Zoom account
            </button>
            <Link
              href="/api/admin/zoom/connect"
              className="btn-ghost px-3 py-1 text-xs"
              onClick={(e) => {
                setBanner(null);
                if (busy) {
                  e.preventDefault();
                  return;
                }
                setBusy(true);
                window.setTimeout(() => setBusy(false), 8000);
              }}
              aria-disabled={busy}
            >
              {busy ? "Opening Zoom…" : "Connect Zoom account"}
            </Link>
          </>
        ) : showServerOnly ? (
          <span className="text-xs text-[var(--muted)]">
            Server credentials configured — no coach login needed.
          </span>
        ) : null}
      </div>

      {manageOpen ? (
        <div className="space-y-3 rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-sky-100">
                Switch to {requiredHost}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Zoom keeps you logged in in the browser. If you only Disconnect and Connect, Zoom
                often re-links the previous account (e.g. john@thetrainstation.co). Sign out of
                Zoom first, then sign into Zoom as <strong>{requiredHost}</strong> so recordings
                land on Jeremy&apos;s laptop. Train Station will reject any other Zoom user.
              </p>
            </div>
            <button
              type="button"
              className="btn-ghost shrink-0 px-2 py-1 text-xs"
              onClick={() => {
                setManageOpen(false);
                setZoomLogoutDone(false);
              }}
            >
              Close
            </button>
          </div>

          <ol className="list-decimal space-y-3 pl-5 text-sm">
            <li>
              <p className="font-medium">Unlink Train Station from the current Zoom</p>
              {status.connected ? (
                <button
                  type="button"
                  className="btn-ghost mt-1 px-3 py-1 text-xs"
                  disabled={busy}
                  onClick={() => void disconnect({ openManage: true })}
                >
                  {busy ? "Unlinking…" : "1 · Disconnect current Zoom"}
                </button>
              ) : (
                <p className="mt-1 text-xs text-emerald-300">Done — Train Station is unlinked.</p>
              )}
            </li>
            <li>
              <p className="font-medium">Sign out of Zoom in this browser</p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                Opens zoom.us/logout. Finish sign-out there (use &quot;Sign in with a different
                account&quot; if Zoom still shows the old name).
              </p>
              <button
                type="button"
                className="btn-ghost mt-1 px-3 py-1 text-xs"
                onClick={openZoomLogout}
              >
                2 · Sign out of Zoom
              </button>
              {zoomLogoutDone ? (
                <p className="mt-1 text-xs text-sky-200">Logout tab opened — complete it, then step 3.</p>
              ) : null}
            </li>
            <li>
              <p className="font-medium">Connect as {requiredHost}</p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                On Zoom&apos;s page, sign in as <strong>{requiredHost}</strong> (not a personal Gmail
                or john@). Approve access only when that email is shown.
              </p>
              {!status.connected && status.oauthAppConfigured ? (
                <Link
                  href="/api/admin/zoom/connect?switch=1"
                  className={`btn-primary mt-2 inline-flex px-4 py-2 text-sm ${
                    !zoomLogoutDone ? "opacity-90" : ""
                  }`}
                  onClick={(e) => {
                    setBanner(null);
                    if (busy) {
                      e.preventDefault();
                      return;
                    }
                    if (!zoomLogoutDone) {
                      const ok = window.confirm(
                        "Have you signed out of Zoom in the other tab?\n\nIf not, Zoom may reconnect the previous account and recordings will go there again.",
                      );
                      if (!ok) {
                        e.preventDefault();
                        return;
                      }
                    }
                    setBusy(true);
                    window.setTimeout(() => setBusy(false), 8000);
                  }}
                >
                  {busy ? "Opening Zoom…" : "3 · Connect my Zoom account"}
                </Link>
              ) : status.connected ? (
                <p className="mt-1 text-xs text-amber-200">Finish step 1 first (disconnect).</p>
              ) : null}
            </li>
          </ol>
        </div>
      ) : null}

      {status.connected && status.sdkConfigured ? (
        <p className="text-xs text-[var(--muted)]">
          After changing Zoom app permissions in the Marketplace, use Manage Zoom account to
          disconnect and connect again so embedded video on Go to Today picks up new scopes.
        </p>
      ) : null}
    </section>
  );
}
