"use client";

import Link from "next/link";

export default function MemberMeasurementSessionCard({
  mode,
  completedToday = false,
}: {
  mode: "today" | "tomorrow";
  completedToday?: boolean;
}) {
  if (mode === "tomorrow") {
    return (
      <div className="card border-dashed border-accent/40 bg-accent/10 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Tomorrow</p>
        <h2 className="mt-1 text-lg font-semibold">Measurement day</h2>
        <p className="mt-1 text-sm text-[color-mix(in_srgb,var(--text)_80%,var(--muted))]">
          Grab your tape tonight. Tomorrow this shows up on Today like a workout block — neck,
          chest, waist, and the rest.
        </p>
      </div>
    );
  }

  if (completedToday) {
    return (
      <div className="card border border-[var(--success)]/35 bg-[var(--success)]/8 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--success)]">
          Today · measurements
        </p>
        <h2 className="mt-1 text-lg font-semibold">Check-in logged</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Tape session is done for today.</p>
        <Link href="/member/measurements" className="mt-3 inline-block text-sm font-semibold text-accent">
          Review sheet →
        </Link>
      </div>
    );
  }

  return (
    <div className="card space-y-3 border-accent/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">
        Today · like a workout
      </p>
      <h2 className="text-lg font-semibold">Measurement session</h2>
      <p className="text-sm text-[color-mix(in_srgb,var(--text)_82%,var(--muted))]">
        This is today&apos;s first block — same as a warm-up. Log tape + weight, then hit your
        lifts.
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--text)]">
        <li>Neck, chest, shoulders</li>
        <li>Waist, hips, arms, legs</li>
        <li>Save the check-in</li>
      </ol>
      <Link href="/member/measurements" className="btn-primary inline-flex justify-center">
        Start measurements →
      </Link>
    </div>
  );
}
