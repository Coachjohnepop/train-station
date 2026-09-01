"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type InboxItem = {
  id: string;
  kind: "signup" | "booking" | "zoom";
  title: string;
  body: string;
  href: string | null;
  memberName: string | null;
  memberEmail: string | null;
  readAt: string | null;
  createdAt: string;
};

const KIND_LABEL: Record<InboxItem["kind"], string> = {
  signup: "Signup",
  booking: "Calendly / booking",
  zoom: "Zoom request",
};

const KIND_HREF: Record<InboxItem["kind"], string> = {
  signup: "/admin/members",
  booking: "/admin/bookings",
  zoom: "/admin/today",
};

function whenLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AdminCoachInbox() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState<"all" | InboxItem["kind"]>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const qs = filter === "all" ? "" : `?kind=${filter}`;
    const res = await fetch(`/api/admin/inbox${qs}`, { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as {
      items?: InboxItem[];
      unread?: number;
      error?: string;
    };
    if (!res.ok) {
      setError(data.error || "Could not load alerts.");
      setItems([]);
    } else {
      setItems(data.items || []);
      setUnread(typeof data.unread === "number" ? data.unread : 0);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    void load();
    const id = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(id);
  }, [load]);

  async function markRead(id: string) {
    await fetch("/api/admin/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read", id }),
    });
    window.dispatchEvent(new Event("coach-inbox-refresh"));
    await load();
  }

  async function markAll() {
    await fetch("/api/admin/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "readAll" }),
    });
    window.dispatchEvent(new Event("coach-inbox-refresh"));
    await load();
  }

  const filters: Array<"all" | InboxItem["kind"]> = ["all", "signup", "booking", "zoom"];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              filter === f ? "bg-[#7c3aed] text-white" : "btn-ghost"
            }`}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : KIND_LABEL[f]}
          </button>
        ))}
        <button
          type="button"
          className="ml-auto text-xs font-semibold text-[var(--accent)] underline"
          disabled={unread <= 0}
          onClick={() => void markAll()}
        >
          Mark all read
        </button>
      </div>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {loading && !items.length ? (
        <p className="text-sm text-[var(--muted)]">Loading alerts…</p>
      ) : null}
      {!loading && items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
          No {filter === "all" ? "" : `${KIND_LABEL[filter].toLowerCase()} `}alerts yet. New
          signups, Calendly bookings, and Zoom join taps land here.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const href = item.href || KIND_HREF[item.kind];
            const unreadItem = !item.readAt;
            return (
              <li
                key={item.id}
                className={`rounded-xl border p-4 ${
                  unreadItem
                    ? "border-violet-500/40 bg-violet-500/10"
                    : "border-[var(--border)] bg-[var(--surface)]"
                }`}
              >
                <div className="flex flex-wrap items-start gap-2">
                  <span className="rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-200">
                    {KIND_LABEL[item.kind]}
                  </span>
                  <span className="text-[11px] text-[var(--muted)]">{whenLabel(item.createdAt)}</span>
                  {unreadItem ? (
                    <span className="text-[10px] font-bold uppercase text-amber-300">New</span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm font-semibold text-[var(--text)]">{item.title}</p>
                {item.memberName || item.memberEmail ? (
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {item.memberName}
                    {item.memberEmail ? ` · ${item.memberEmail}` : ""}
                  </p>
                ) : null}
                <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--muted)]">{item.body}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={href} className="btn-primary px-3 py-1.5 text-xs font-semibold">
                    Open
                  </Link>
                  {unreadItem ? (
                    <button
                      type="button"
                      className="btn-ghost px-3 py-1.5 text-xs"
                      onClick={() => void markRead(item.id)}
                    >
                      Mark read
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
