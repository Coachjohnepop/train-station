"use client";

import { useCallback, useEffect, useState } from "react";

type Suggestion = {
  id: string;
  coachEmail: string;
  coachName: string;
  pagePath: string | null;
  userMessage: string;
  assistantReply: string;
  createdAt: string;
  readAt: string | null;
};

export default function CoachHelpSuggestionsInbox() {
  const [rows, setRows] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/help-suggestions", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not load suggestions.");
      setRows([]);
    } else {
      setRows(data.suggestions || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: string) {
    await fetch("/api/admin/help-suggestions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, read: true }),
    });
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, readAt: new Date().toISOString() } : r)),
    );
  }

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading coach suggestions…</p>;
  if (error) return <p className="text-sm text-amber-300">{error}</p>;

  const unread = rows.filter((r) => !r.readAt);

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        Questions and ideas Jeremy sent from the in-app Grok help panel ({unread.length} unread).
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No suggestions yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className={`card space-y-2 p-4 text-sm ${row.readAt ? "opacity-70" : "ring-1 ring-accent/30"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
                <span>
                  {row.coachName} · {new Date(row.createdAt).toLocaleString()}
                  {row.pagePath ? ` · ${row.pagePath}` : ""}
                </span>
                {!row.readAt && (
                  <button
                    type="button"
                    className="text-accent hover:underline"
                    onClick={() => void markRead(row.id)}
                  >
                    Mark read
                  </button>
                )}
              </div>
              <p className="font-medium text-[var(--foreground)]">{row.userMessage}</p>
              <p className="text-[var(--muted)] whitespace-pre-wrap">{row.assistantReply}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}