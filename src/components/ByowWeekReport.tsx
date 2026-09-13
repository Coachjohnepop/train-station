import Link from "next/link";
import type { ByowWeekReport } from "@/lib/byow-report";

export default function ByowWeekReportCard({ report }: { report: ByowWeekReport }) {
  return (
    <section className="space-y-3 rounded-2xl border border-[var(--ramp-gold)]/35 bg-[color-mix(in_srgb,var(--ramp-gold)_8%,var(--surface))] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ramp-gold-light)]">
        This week
      </p>
      <p className="text-base leading-relaxed text-[var(--text)]">{report.narrative}</p>
      <div className="grid grid-cols-3 gap-2 pt-1">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2 text-center">
          <p className="text-xl font-semibold tabular-nums">{report.sessions}</p>
          <p className="text-[10px] uppercase text-[var(--muted)]">Sessions</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2 text-center">
          <p className="text-xl font-semibold tabular-nums">
            {report.avgMinutes || "—"}
          </p>
          <p className="text-[10px] uppercase text-[var(--muted)]">Avg min</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2 text-center">
          <p className="text-xl font-semibold tabular-nums">{report.attendancePct}%</p>
          <p className="text-[10px] uppercase text-[var(--muted)]">Attendance</p>
        </div>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Check off a workout to log it. Report uses Monday–Sunday Pacific time.
      </p>
      <Link href="/member/byow" className="text-xs text-accent hover:underline">
        Back to my notes
      </Link>
    </section>
  );
}
