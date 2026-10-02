"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPhoneDisplay, toE164 } from "@/lib/sms-phone";
import type { WaitlistEntry } from "@/lib/waitlist";
import {
  countLeadsByFilter,
  leadMatchesFilter,
  normalizeLeadLane,
  type LeadFilter,
  type LeadLane,
} from "@/lib/waitlist-lane";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type DateSort = "newest" | "oldest";

const FILTER_TABS: { id: LeadFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "archive", label: "Archive" },
  { id: "drip", label: "Drip Campaign" },
  { id: "convert", label: "Convert and send join link" },
];

function laneChip(lane: LeadLane) {
  if (lane === "inbox") return null;
  const styles =
    lane === "drip"
      ? "bg-sky-500/15 text-sky-300"
      : lane === "convert"
        ? "bg-emerald-500/15 text-emerald-300"
        : "bg-[var(--surface-2)] text-[var(--muted)]";
  const label =
    lane === "drip" ? "Drip" : lane === "convert" ? "Join link sent" : "Archived";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${styles}`}>
      {label}
    </span>
  );
}

export default function AdminLeadsTable({ leads }: { leads: WaitlistEntry[] }) {
  const router = useRouter();
  const [dateSort, setDateSort] = useState<DateSort>("newest");
  const [filter, setFilter] = useState<LeadFilter>("all");
  const [rows, setRows] = useState(leads);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setRows(leads);
  }, [leads]);

  const counts = useMemo(() => countLeadsByFilter(rows), [rows]);

  const sorted = useMemo(() => {
    const copy = rows.filter((lead) => leadMatchesFilter(lead, filter));
    copy.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      const na = Number.isFinite(ta) ? ta : 0;
      const nb = Number.isFinite(tb) ? tb : 0;
      return dateSort === "newest" ? nb - na : na - nb;
    });
    return copy;
  }, [rows, dateSort, filter]);

  function toggleDateSort() {
    setDateSort((d) => (d === "newest" ? "oldest" : "newest"));
  }

  async function moveLead(email: string, lane: LeadLane) {
    setBusyEmail(email);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, lane }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        lead?: WaitlistEntry;
        emailSent?: boolean | null;
      };
      if (!res.ok || !data.lead) {
        setNotice(data.error || "Could not update that lead.");
        return;
      }
      setRows((current) => {
        const next = current.map((row) =>
          row.email.toLowerCase() === data.lead!.email.toLowerCase() ? { ...row, ...data.lead } : row,
        );
        if (!next.some((row) => row.email.toLowerCase() === data.lead!.email.toLowerCase())) {
          next.unshift(data.lead!);
        }
        return next;
      });
      if (lane === "convert") {
        setNotice(
          data.emailSent
            ? `Join link sent to ${data.lead.email}.`
            : `Moved to Convert. Join link email did not send — try again.`,
        );
      }
      router.refresh();
    } catch {
      setNotice("Could not update that lead.");
    } finally {
      setBusyEmail(null);
    }
  }

  const emptyCopy =
    rows.length === 0
      ? {
          title: "No leads yet.",
          body: "New pre-sign-ups from the landing page will appear here.",
        }
      : filter === "archive"
        ? { title: "Archive is empty.", body: "Archived leads will show up here." }
        : filter === "drip"
          ? {
              title: "No one on the drip campaign yet.",
              body: "Move a lead here when you want Jeremy to keep following up.",
            }
          : filter === "convert"
            ? {
                title: "No converted leads yet.",
                body: "Convert a lead to email them the join link.",
              }
            : {
                title: "No leads in this filter.",
                body: "Archived leads live under Archive.",
              };

  function actionsFor(lead: WaitlistEntry) {
    const lane = normalizeLeadLane(lead.lane);
    const busy = busyEmail === lead.email;
    const btn =
      "min-h-[44px] rounded-lg px-3 py-2 text-left text-xs font-semibold transition disabled:opacity-60 md:min-h-0 md:py-1.5";
    return (
      <div className="flex flex-col gap-2">
        {lane !== "drip" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void moveLead(lead.email, "drip")}
            className={`${btn} bg-sky-500/15 text-sky-200 hover:bg-sky-500/25`}
          >
            {busy ? "…" : "Drip Campaign"}
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void moveLead(lead.email, "convert")}
          className={`${btn} bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25`}
        >
          {busy ? "…" : lane === "convert" ? "Send join link again" : "Convert and send join link"}
        </button>
        {lane !== "archive" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void moveLead(lead.email, "archive")}
            className={`${btn} bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--text)]`}
          >
            {busy ? "…" : "Archive"}
          </button>
        ) : null}
        {lane !== "inbox" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void moveLead(lead.email, "inbox")}
            className={`${btn} bg-[var(--surface-2)] text-[var(--text)] hover:text-accent`}
          >
            {busy ? "…" : "Restore"}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => {
          const count = counts[tab.id];
          const active = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "nav-tab-active text-accent"
                  : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              {tab.label}
              {tab.id !== "all" && count > 0 ? ` (${count})` : ""}
            </button>
          );
        })}
      </div>

      {notice ? (
        <p className="text-sm text-accent" role="status">
          {notice}
        </p>
      ) : null}

      {sorted.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-2 py-16 text-center">
          <p className="text-sm font-medium">{emptyCopy.title}</p>
          <p className="text-xs text-[var(--muted)]">{emptyCopy.body}</p>
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {sorted.map((lead) => (
              <article
                key={lead.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold">{lead.name || "Guest"}</p>
                  {laneChip(normalizeLeadLane(lead.lane))}
                </div>
                <a href={`mailto:${lead.email}`} className="mt-0.5 block text-sm text-accent hover:underline">
                  {lead.email}
                </a>
                {lead.phone ? (
                  <a
                    href={`tel:${toE164(lead.phone)}`}
                    className="mt-1 block font-mono text-sm hover:text-accent hover:underline"
                  >
                    {formatPhoneDisplay(lead.phone) || lead.phone}
                  </a>
                ) : null}
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {lead.plan || "—"} · {lead.source || "—"} · {formatDate(lead.createdAt)}
                </p>
                <div className="mt-3">{actionsFor(lead)}</div>
              </article>
            ))}
          </div>

          <div className="card hidden overflow-x-auto p-0 md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-[2px] text-[var(--muted)]">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Interest</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">
                    <button
                      type="button"
                      onClick={toggleDateSort}
                      className="inline-flex items-center gap-1.5 rounded-md font-medium uppercase tracking-[2px] text-[var(--muted)] transition hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                      aria-label={
                        dateSort === "newest"
                          ? "Sorted newest first. Click for oldest first."
                          : "Sorted oldest first. Click for newest first."
                      }
                      title={
                        dateSort === "newest"
                          ? "Newest first — click for oldest"
                          : "Oldest first — click for newest"
                      }
                    >
                      Date
                      <span className="text-[11px] font-semibold text-accent normal-case tracking-normal" aria-hidden>
                        {dateSort === "newest" ? "↓ new" : "↑ old"}
                      </span>
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]"
                  >
                    <td className="px-4 py-3 font-medium">
                      <div className="flex flex-wrap items-center gap-2">
                        {lead.name || "Guest"}
                        {laneChip(normalizeLeadLane(lead.lane))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <a href={`mailto:${lead.email}`} className="text-accent hover:underline">
                        {lead.email}
                      </a>
                    </td>
                    <td className="px-4 py-3 font-mono text-[var(--text)]">
                      {lead.phone ? (
                        <a
                          href={`tel:${toE164(lead.phone)}`}
                          className="hover:text-accent hover:underline"
                          title={lead.phone}
                        >
                          {formatPhoneDisplay(lead.phone) || lead.phone}
                        </a>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{lead.plan || "—"}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{lead.source || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-[var(--muted)]">
                      {formatDate(lead.createdAt)}
                    </td>
                    <td className="px-4 py-3">{actionsFor(lead)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
