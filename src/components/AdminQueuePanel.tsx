"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type QueueAction = "approve" | "mark_paid" | "intake" | "meeting" | "message";

type QueueItem = {
  userId: string;
  email: string;
  name: string;
  phone: string | null;
  plan: string;
  planLabel: string;
  reason: string;
  action: QueueAction;
  meetingNote: string | null;
};

export default function AdminQueuePanel() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [approving, setApproving] = useState<string | null>(null);
  const [intakeSigning, setIntakeSigning] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [markPaidTarget, setMarkPaidTarget] = useState<QueueItem | null>(null);
  const [markPaidMethod, setMarkPaidMethod] = useState<"venmo" | "manual" | "stripe" | "other">(
    "venmo",
  );
  const [markPaidNote, setMarkPaidNote] = useState("");

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/queue");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not load queue.");
      setItems([]);
    } else {
      setItems(data.items || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  async function approveMember(userId: string) {
    setApproving(userId);
    setError("");
    const res = await fetch(`/api/admin/members/${encodeURIComponent(userId)}/approve`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Approve failed.");
    } else {
      await loadQueue();
    }
    setApproving(null);
  }

  async function completeIntake(userId: string) {
    setIntakeSigning(userId);
    setError("");
    const res = await fetch(`/api/admin/members/${encodeURIComponent(userId)}/intake`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Intake sign-off failed.");
    } else {
      await loadQueue();
    }
    setIntakeSigning(null);
  }

  async function dismissMeeting(userId: string) {
    setDismissing(userId);
    setError("");
    const res = await fetch(
      `/api/admin/members/${encodeURIComponent(userId)}/meeting-request`,
      { method: "DELETE" },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not dismiss meeting.");
    } else {
      await loadQueue();
    }
    setDismissing(null);
  }

  async function submitMarkPaid() {
    if (!markPaidTarget) return;
    setMarkingPaid(markPaidTarget.userId);
    setError("");
    const res = await fetch(
      `/api/admin/members/${encodeURIComponent(markPaidTarget.userId)}/mark-paid`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: markPaidMethod,
          note: markPaidNote.trim() || undefined,
        }),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Mark paid failed.");
    } else {
      setMarkPaidTarget(null);
      setMarkPaidNote("");
      await loadQueue();
    }
    setMarkingPaid(null);
  }

  function renderActions(item: QueueItem) {
    switch (item.action) {
      case "approve":
        return (
          <button
            type="button"
            onClick={() => void approveMember(item.userId)}
            disabled={approving === item.userId}
            className="btn-primary text-xs px-3 py-1.5"
          >
            {approving === item.userId ? "…" : "Approve"}
          </button>
        );
      case "mark_paid":
        return (
          <button
            type="button"
            onClick={() => {
              setMarkPaidTarget(item);
              setMarkPaidMethod("venmo");
              setMarkPaidNote("");
            }}
            disabled={markingPaid === item.userId}
            className="btn-ghost text-xs px-3 py-1.5 ring-1 ring-emerald-500/40 text-emerald-300"
          >
            Mark paid
          </button>
        );
      case "intake":
        return (
          <button
            type="button"
            onClick={() => void completeIntake(item.userId)}
            disabled={intakeSigning === item.userId}
            className="btn-ghost text-xs px-3 py-1.5 ring-1 ring-sky-500/40 text-sky-300"
          >
            {intakeSigning === item.userId ? "…" : "Sign off intake"}
          </button>
        );
      case "meeting":
        return (
          <>
            <Link
              href={`/admin/chat?member=${encodeURIComponent(item.userId)}`}
              className="btn-ghost text-xs px-3 py-1.5 ring-1 ring-accent/30 text-accent"
            >
              Message
            </Link>
            <button
              type="button"
              onClick={() => void dismissMeeting(item.userId)}
              disabled={dismissing === item.userId}
              className="btn-ghost text-xs px-3 py-1.5 text-[var(--muted)]"
            >
              {dismissing === item.userId ? "…" : "Dismiss"}
            </button>
          </>
        );
      case "message":
        return (
          <Link
            href={`/admin/chat?member=${encodeURIComponent(item.userId)}`}
            className="btn-ghost text-xs px-3 py-1.5 ring-1 ring-accent/30 text-accent"
          >
            Message
          </Link>
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Queue</h1>
        <p className="text-sm text-[var(--muted)]">
          Members who need your attention — approve, payment, intake, or follow-up.
        </p>
      </div>

      {error && <p className="text-sm text-amber-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading queue…</p>
      ) : items.length === 0 ? (
        <div className="card py-16 text-center">
          <p className="text-sm font-medium">Queue is clear.</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            New signups will show up here when they need action.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={`${item.userId}-${item.action}`}>
              <div className="card flex min-h-[56px] flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-[var(--muted)]">{item.email}</p>
                  {item.phone && (
                    <p className="text-xs text-[var(--muted)]">{item.phone}</p>
                  )}
                </div>
                <span className="rounded-full bg-amber-500/15 px-3 py-1 text-[10px] font-semibold uppercase text-amber-200">
                  {item.reason}
                </span>
                <div className="flex flex-wrap items-center gap-2">{renderActions(item)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Link href="/admin/members" className="text-sm text-accent hover:underline">
        Open full members table →
      </Link>

      {markPaidTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md space-y-4 p-6">
            <h2 className="text-lg font-semibold">Mark paid</h2>
            <p className="text-sm text-[var(--muted)]">
              {markPaidTarget.name} · {markPaidTarget.planLabel}
            </p>
            <div>
              <label htmlFor="queue-pay-method" className="text-xs font-medium text-[var(--muted)]">
                Payment method
              </label>
              <select
                id="queue-pay-method"
                className="input mt-1 w-full"
                value={markPaidMethod}
                onChange={(e) =>
                  setMarkPaidMethod(e.target.value as "venmo" | "manual" | "stripe" | "other")
                }
              >
                <option value="venmo">Venmo</option>
                <option value="manual">Manual / cash</option>
                <option value="stripe">Stripe (manual confirm)</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="queue-pay-note" className="text-xs font-medium text-[var(--muted)]">
                Note (optional)
              </label>
              <input
                id="queue-pay-note"
                className="input mt-1 w-full"
                placeholder="e.g. Venmo @john — June signup"
                value={markPaidNote}
                onChange={(e) => setMarkPaidNote(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-ghost text-sm"
                onClick={() => setMarkPaidTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={markingPaid === markPaidTarget.userId}
                onClick={() => void submitMarkPaid()}
              >
                {markingPaid === markPaidTarget.userId ? "Saving…" : "Confirm paid"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}