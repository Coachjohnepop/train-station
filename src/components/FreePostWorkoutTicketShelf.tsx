"use client";

import Link from "next/link";
import { purchaseHref } from "@/lib/member-purchase-path";

const TICKETS = [
  {
    plan: "member" as const,
    name: "Coach Class",
    blurb: "Full calendar, live floor, coach Messages — the real board.",
  },
  {
    plan: "business" as const,
    name: "Business Class",
    blurb: "Silver trim + multi-program seat for teams and serious grinders.",
  },
  {
    plan: "pro" as const,
    name: "1st Class",
    blurb: "Gold seat — priority access and the top of the ladder.",
  },
];

/** Celebration → next ticket moment after a Free Explorer workout logs. */
export default function FreePostWorkoutTicketShelf({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div
      id="free-post-workout-tickets"
      className="card space-y-3 border-amber-500/40 bg-gradient-to-br from-amber-500/12 via-[var(--surface)] to-[var(--surface-2)] p-4"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-600">
        Nice work · where next?
      </p>
      <h3 className="text-lg font-bold text-[var(--text)]">Climb the ticket ladder</h3>
      <p className="text-sm text-[var(--muted)]">
        Free Explorer keeps rolling scores in steps of 10. Coach Class earns about 8× for the same
        actions — and unlocks the rest of the board.
      </p>
      <ul className="space-y-2">
        {TICKETS.map((t) => (
          <li key={t.plan}>
            <Link
              href={purchaseHref(t.plan, { signedIn: true, role: "MEMBER" })}
              className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 transition hover:border-[var(--accent)]/50"
            >
              <span className="text-sm font-bold text-[var(--text)]">{t.name}</span>
              <span className="text-[11px] leading-snug text-[var(--muted)]">{t.blurb}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/join#tickets"
        className="inline-block text-xs font-semibold text-[var(--accent-fg)] hover:underline"
      >
        Compare all tickets →
      </Link>
    </div>
  );
}
