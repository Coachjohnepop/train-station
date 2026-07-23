"use client";

import { Fragment, useCallback, useEffect, useState } from "react";

type AuditRow = {
  id: string;
  occurredAt: string;
  action: string;
  outcome: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  entityType: string | null;
  entityId: string | null;
  ip: string | null;
  metadata: unknown;
};

export default function AdminAuditClient() {
  const [events, setEvents] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [entityType, setEntityType] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const q = new URLSearchParams({ limit: "80" });
    if (action.trim()) q.set("action", action.trim());
    if (actor.trim()) q.set("actor", actor.trim());
    if (entityType.trim()) q.set("entityType", entityType.trim());
    try {
      const res = await fetch(`/api/admin/audit?${q}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Could not load audit log.");
        setEvents([]);
      } else {
        setEvents(body.events || []);
      }
    } catch {
      setError("Network error loading audit log.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [action, actor, entityType]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="card grid gap-3 p-4 sm:grid-cols-4">
        <label className="block text-sm sm:col-span-1">
          <span className="text-[var(--muted)]">Action contains</span>
          <input
            className="input mt-1 w-full"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="member.mark_paid"
          />
        </label>
        <label className="block text-sm sm:col-span-1">
          <span className="text-[var(--muted)]">Actor (email / role / id)</span>
          <input
            className="input mt-1 w-full"
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            placeholder="jeremy@ or system"
          />
        </label>
        <label className="block text-sm sm:col-span-1">
          <span className="text-[var(--muted)]">Entity type</span>
          <input
            className="input mt-1 w-full"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            placeholder="user / stripe_refund"
          />
        </label>
        <div className="flex items-end gap-2">
          <button type="button" className="btn-primary text-sm" disabled={loading} onClick={() => void load()}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {error}
        </p>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-[2px] text-[var(--muted)]">
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Outcome</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Entity</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <Fragment key={e.id}>
                <tr className="border-b border-[var(--border)] last:border-0">
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-[var(--muted)]">
                    {new Date(e.occurredAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{e.action}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        e.outcome === "success"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : e.outcome === "failure"
                            ? "bg-rose-500/15 text-rose-300"
                            : "bg-[var(--surface-2)] text-[var(--muted)]"
                      }`}
                    >
                      {e.outcome}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <div>{e.actorEmail || e.actorRole || "—"}</div>
                    {e.actorRole && e.actorEmail && (
                      <div className="text-[10px] text-[var(--muted)]">{e.actorRole}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-[var(--muted)]">
                    {e.entityType || "—"}
                    {e.entityId ? (
                      <span className="block max-w-[12rem] truncate font-mono text-[10px]">
                        {e.entityId}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="btn-ghost text-[10px]"
                      onClick={() => setExpanded((id) => (id === e.id ? null : e.id))}
                    >
                      {expanded === e.id ? "Hide" : "Detail"}
                    </button>
                  </td>
                </tr>
                {expanded === e.id && (
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                    <td colSpan={6} className="px-3 py-3">
                      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-[10px] text-[var(--muted)]">
                        {JSON.stringify(
                          {
                            ip: e.ip,
                            actorUserId: e.actorUserId,
                            metadata: e.metadata,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!loading && events.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-[var(--muted)]">
                  No audit rows yet. Mark paid, refund, discount create, and tips will appear here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
