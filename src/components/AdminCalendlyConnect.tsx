"use client";

import { useCallback, useEffect, useState } from "react";

type CalendlyStatus = {
  ok: boolean;
  tokenConfigured: boolean;
  tokenSource: "env" | "db" | "mixed" | null;
  webhookKeyConfigured: boolean;
  webhookRegistered?: boolean;
  connectedEmail: string | null;
  connectedName: string | null;
  me: { email: string | null; name: string | null } | null;
  webhooks: Array<{ callbackUrl: string; state: string | null; events: string[] }>;
  webhookUrl: string;
  hint?: string;
  detail?: string;
  error?: string;
};

type BackfillResult = {
  ok: boolean;
  scanned: number;
  synced: number;
  skipped: number;
  results: Array<{ email: string; ok: boolean; detail: string }>;
  detail?: string;
};

export default function AdminCalendlyConnect() {
  const [status, setStatus] = useState<CalendlyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const [syncEmail, setSyncEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backfill, setBackfill] = useState<BackfillResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/calendly", { cache: "no-store" });
      const data = (await res.json()) as CalendlyStatus;
      if (res.ok) setStatus(data);
      else setError(data.error || "Could not load Calendly status.");
    } catch {
      setError("Could not load Calendly status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(action: string, extra?: Record<string, string>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/calendly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = (await res.json()) as CalendlyStatus & BackfillResult & { error?: string };
      if (!res.ok) {
        setError(data.error || data.detail || "Request failed.");
        return data;
      }
      if ("scanned" in data) setBackfill(data as BackfillResult);
      setMessage(data.detail || (data.ok ? "Done." : null));
      if (action === "connect") setToken("");
      if (action === "connect" || action === "disconnect" || action === "ensure-webhook") {
        await load();
      }
      return data;
    } catch {
      setError("Network error talking to Calendly.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  const connected = Boolean(status?.tokenConfigured);
  const who =
    status?.me?.email ||
    status?.connectedEmail ||
    status?.me?.name ||
    status?.connectedName ||
    null;

  return (
    <section className="card">
      <h2 className="font-semibold mb-2">Calendly API</h2>
      <p className="text-sm text-[var(--muted)] mb-3">
        Pulls Calendly’s own change-appointment links into booking emails, and records the
        intro even when the embed forgets the start time. Token stays on the server — never
        shown back here.
      </p>

      {loading && <p className="text-sm text-[var(--muted)]">Checking Calendly…</p>}
      {error && <p className="text-sm text-[var(--danger)] mb-2">{error}</p>}
      {message && <p className="text-sm text-[var(--success)] mb-2">{message}</p>}

      {!loading && (
        <p className="text-sm mb-3">
          {connected ? (
            <>
              Connected{who ? ` as ${who}` : ""}.
              {status?.tokenSource === "env" ? " Token is on Vercel." : null}
              {status?.tokenSource === "db" ? " Token was pasted here." : null}
              {status?.webhookRegistered
                ? " Webhook is live."
                : " Webhook is not registered yet."}
              {status?.webhookKeyConfigured ? "" : " Signing key is still missing."}
            </>
          ) : (
            "Not connected yet. Paste Jeremy’s personal access token below."
          )}
        </p>
      )}

      <ol className="text-sm text-[var(--muted)] list-decimal pl-5 mb-3 space-y-1">
        <li>
          On Jeremy’s phone or laptop: open{" "}
          <a
            className="underline"
            href="https://calendly.com/integrations/api_webhooks"
            target="_blank"
            rel="noreferrer"
          >
            Calendly → Integrations &amp; apps → API &amp; webhooks
          </a>
        </li>
        <li>Get a personal access token. Copy it once — Calendly will not show it again.</li>
        <li>Paste it here and tap Connect. We register the webhook automatically.</li>
      </ol>

      <label className="block mb-2">
        <span className="text-xs text-[var(--muted)]">Personal access token</span>
        <input
          className="input mt-1 w-full"
          type="password"
          autoComplete="off"
          placeholder="Paste token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          className="btn-primary"
          disabled={busy || !token.trim()}
          onClick={() => void post("connect", { token: token.trim() })}
        >
          {busy ? "Connecting…" : "Connect Calendly"}
        </button>
        {connected ? (
          <>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => void post("ensure-webhook")}
            >
              Register webhook
            </button>
            {status?.tokenSource !== "env" ? (
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => void post("disconnect")}
              >
                Disconnect stored token
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      {connected ? (
        <div className="space-y-3 border-t border-[var(--border)] pt-3">
          <p className="text-sm text-[var(--muted)]">
            Pull missing intro bookings from Calendly. Does not email members.
          </p>
          <div className="flex flex-wrap gap-2 items-end">
            <label className="block grow min-w-[12rem]">
              <span className="text-xs text-[var(--muted)]">Sync one email</span>
              <input
                className="input mt-1 w-full"
                type="email"
                placeholder="member@email.com"
                value={syncEmail}
                onChange={(e) => setSyncEmail(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy || !syncEmail.trim()}
              onClick={() => void post("sync", { email: syncEmail.trim() })}
            >
              Sync
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => void post("backfill")}
            >
              Backfill missing bookings
            </button>
          </div>
          {backfill ? (
            <p className="text-sm text-[var(--muted)]">
              Scanned {backfill.scanned}: synced {backfill.synced}, skipped {backfill.skipped}.
              {backfill.results.some((r) => !r.ok)
                ? ` Misses: ${backfill.results
                    .filter((r) => !r.ok)
                    .map((r) => r.email)
                    .join(", ")}.`
                : ""}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
