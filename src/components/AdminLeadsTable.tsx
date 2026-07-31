"use client";

import { useMemo, useState } from "react";
import { formatPhoneDisplay, toE164 } from "@/lib/sms-phone";
import type { WaitlistEntry } from "@/lib/waitlist";

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

export default function AdminLeadsTable({ leads }: { leads: WaitlistEntry[] }) {
  const [dateSort, setDateSort] = useState<DateSort>("newest");

  const sorted = useMemo(() => {
    const copy = [...leads];
    copy.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      const na = Number.isFinite(ta) ? ta : 0;
      const nb = Number.isFinite(tb) ? tb : 0;
      return dateSort === "newest" ? nb - na : na - nb;
    });
    return copy;
  }, [leads, dateSort]);

  function toggleDateSort() {
    setDateSort((d) => (d === "newest" ? "oldest" : "newest"));
  }

  return (
    <div className="card overflow-x-auto p-0">
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
          </tr>
        </thead>
        <tbody>
          {sorted.map((lead) => (
            <tr
              key={lead.id}
              className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]"
            >
              <td className="px-4 py-3 font-medium">{lead.name || "Guest"}</td>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
