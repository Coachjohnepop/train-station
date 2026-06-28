"use client";

import Link from "next/link";
import { COACH_CALENDLY_URL } from "@/lib/brand";

export default function MemberIntakeIntroCard() {
  return (
    <div className="card space-y-3 border-[var(--accent)]/30 bg-[var(--accent)]/8 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">
        Before your first live session
      </p>
      <h2 className="text-lg font-semibold leading-tight">Schedule your 15-minute intake</h2>
      <p className="text-sm text-[var(--muted)]">
        Meet Coach Jeremy, talk goals, and get signed off for full programming. You can start your
        warm-ups below while you wait — checking them off alerts your coach so you have more time
        for main lifts.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <a
          href={COACH_CALENDLY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary text-center text-sm"
        >
          Book 15-min intro →
        </a>
        <Link href="/member/chat" className="btn-ghost text-center text-sm">
          Message coach
        </Link>
      </div>
    </div>
  );
}