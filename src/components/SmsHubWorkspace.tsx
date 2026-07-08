"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Recipient = {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
};

type HubLog = {
  sentAt: string;
  message: string;
  phone?: string;
  source?: string;
  direction?: string;
  category?: string;
  userId?: string;
};

export default function SmsHubWorkspace() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [logs, setLogs] = useState<HubLog[]>([]);
  const [hubActive, setHubActive] = useState(true);
  const [messagingEnabled, setMessagingEnabled] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<"general" | "fasted-cardio" | "sleep" | "exercise">("general");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [r, l] = await Promise.all([
      fetch("/api/sms/hub/recipients", { cache: "no-store" }).then((res) => res.json()),
      fetch("/api/sms/hub/logs", { cache: "no-store" }).then((res) => res.json()),
    ]);
    setRecipients(r.recipients || []);
    setHubActive(r.hubActive !== false);
    setMessagingEnabled(r.messagingEnabled !== false);
    setLogs(Array.isArray(l) ? l : []);
    setSelectedIds((prev) =>
      prev.length ? prev : (r.recipients || []).map((u: Recipient) => u.id),
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function sendBroadcast() {
    if (!messagingEnabled) {
      setStatus("Outbound messaging is paused — enable it in Coach settings.");
      return;
    }
    if (!message.trim() || selectedIds.length === 0) return;
    setSending(true);
    setStatus(null);
    try {
      const res = await fetch("/api/sms/hub/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: selectedIds,
          message: message.trim(),
          category,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "Send failed");
        return;
      }
      setStatus(
        `Sent to ${data.sent} member(s) via ${data.channel === "email" ? "email + in-app hub" : data.channel}.`,
      );
      setMessage("");
      await load();
    } catch {
      setStatus("Send failed");
    } finally {
      setSending(false);
    }
  }

  const inbound = logs.filter((l) => l.source === "member-reply" || l.direction === "inbound");
  const outbound = logs.filter((l) => l.source !== "member-reply" && l.direction !== "inbound");

  return (
    <div className="space-y-8">
      {!messagingEnabled ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <strong className="text-amber-200">Outbound messaging is paused.</strong>{" "}
          Hub broadcasts and email alerts are off. Turn messaging back on in{" "}
          <Link href="/admin/settings" className="text-accent underline">
            Coach settings
          </Link>
          . In-app Messages still work.
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
          <strong className="text-emerald-200">No paid phone number required.</strong>{" "}
          Members get email alerts with a link to{" "}
          <Link href="/member/chat" className="text-accent underline">
            in-app Messages
          </Link>
          . Your personal number stays private — replies come through the hub, not text.
          {hubActive ? (
            <span className="block mt-1 text-[var(--muted)]">Active channel: email + in-app (Resend).</span>
          ) : (
            <span className="block mt-1 text-[var(--muted)]">Twilio SMS is configured — hub is bypassed.</span>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-4">
          <h2 className="font-semibold">Broadcast to members</h2>
          <p className="text-xs text-[var(--muted)]">
            Use {"{first}"} or {"{name}"} for personalization. Members reply in the app — you&apos;ll see it in{" "}
            <Link href="/admin/chat" className="text-accent hover:underline">
              Messages
            </Link>
            . For Patreon-style posts to everyone, use{" "}
            <Link href="/admin/chat" className="text-accent hover:underline">
              Community feed
            </Link>{" "}
            (in-app only — not SMS or email).
          </p>

          <div className="max-h-48 overflow-y-auto space-y-1 border border-[var(--border)] rounded-lg p-2">
            {recipients.map((r) => (
              <label key={r.id} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(r.id)}
                  onChange={() => toggle(r.id)}
                />
                <span className="font-medium">{r.name}</span>
                <span className="text-[var(--muted)]">{r.email}</span>
              </label>
            ))}
          </div>

          <div className="flex gap-2 text-[10px]">
            <button type="button" className="btn-ghost px-2 py-0.5" onClick={() => setSelectedIds(recipients.map((r) => r.id))}>
              All
            </button>
            <button type="button" className="btn-ghost px-2 py-0.5" onClick={() => setSelectedIds([])}>
              None
            </button>
          </div>

          <select
            className="input text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
          >
            <option value="general">General</option>
            <option value="fasted-cardio">Fasted cardio check-in</option>
            <option value="sleep">Sleep check-in</option>
            <option value="exercise">Quick exercise / done</option>
          </select>

          <textarea
            className="input text-sm min-h-[100px]"
            placeholder="e.g. Good morning {first} — fasted cardio 20 min today? Reply in the app when done."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <button
            type="button"
            className="btn-primary text-sm"
            disabled={sending || !message.trim() || selectedIds.length === 0}
            onClick={sendBroadcast}
          >
            {sending ? "Sending…" : `Send to ${selectedIds.length} member(s)`}
          </button>
          {status && <p className="text-xs text-[var(--muted)]">{status}</p>}
        </section>

        <section className="card space-y-4">
          <h2 className="font-semibold">Member replies</h2>
          <p className="text-xs text-[var(--muted)]">
            Inbound from the member dashboard or quick-report buttons. Full threads in Messages.
          </p>
          {inbound.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No replies yet.</p>
          ) : (
            <ul className="space-y-2 text-xs max-h-64 overflow-y-auto">
              {inbound.slice(0, 12).map((log, i) => (
                <li key={`${log.sentAt}-${i}`} className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                  <div className="text-[10px] text-[var(--muted)]">{new Date(log.sentAt).toLocaleString()}</div>
                  <div className="mt-1">{log.message}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card">
        <h2 className="font-semibold mb-3">Recent hub activity</h2>
        {outbound.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No outbound messages yet.</p>
        ) : (
          <ul className="space-y-2 text-xs max-h-56 overflow-y-auto">
            {outbound.slice(0, 15).map((log, i) => (
              <li key={`${log.sentAt}-${i}`} className="border-b border-[var(--border)]/40 pb-2">
                <span className="text-[var(--muted)]">{new Date(log.sentAt).toLocaleString()}</span>
                {log.source && (
                  <span className="ml-2 rounded bg-violet-500/20 px-1 text-violet-300">{log.source}</span>
                )}
                <div className="mt-0.5 line-clamp-2">{log.message}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}