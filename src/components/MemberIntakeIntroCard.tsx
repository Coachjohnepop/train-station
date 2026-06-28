"use client";

import Link from "next/link";
import { COACH_CALENDLY_URL } from "@/lib/brand";

export default function MemberIntakeIntroCard() {
  return (
    <div className="intake-next-step-card card space-y-3 p-4 sm:p-5">
      <p className="intake-next-step-badge">
        <span aria-hidden>★</span>
        Your next step
      </p>
      <h2 className="intake-next-step-title text-xl font-bold leading-tight sm:text-2xl">
        Book your 15-minute intro with Coach Jeremy
      </h2>
      <p className="text-sm text-[var(--muted)]">
        This unlocks your full program after coach sign-off. While you wait, knock out the warm-ups
        below — checking them off gives your coach a heads-up so you have more time for main lifts.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="intake-book-btn-wrap sm:pb-5">
          <a
            href={COACH_CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="intake-book-btn w-full text-center sm:w-auto"
          >
            Book 15-min intro →
          </a>
          <span className="intake-guide-pointer" aria-hidden>
            👆
          </span>
        </div>
        <Link href="/member/chat" className="btn-ghost text-center text-sm sm:mb-5">
          Message coach
        </Link>
      </div>
    </div>
  );
}