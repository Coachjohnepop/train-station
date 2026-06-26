"use client";

import Link from "next/link";
import WelcomeVideoPopover from "@/components/WelcomeVideoPopover";

export default function LandingWelcomeBanner({
  displayName,
  email,
  isCoach,
  welcomeVideoUrl = null,
}: {
  displayName: string;
  email?: string;
  isCoach?: boolean;
  welcomeVideoUrl?: string | null;
}) {
  const programHref = isCoach ? "/admin" : "/member";

  return (
    <section className="border-b border-[var(--border)] px-4 py-10 text-center sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Welcome back, {displayName}.
        </h1>
        <p className="mt-3 text-base text-[var(--muted)] sm:text-lg">
          Your programs, progress, and workouts are ready — or pick a membership ticket below.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href={programHref} className="btn-primary px-8">
            {isCoach ? "Coach admin" : "Open dashboard"}
          </Link>
          <WelcomeVideoPopover welcomeVideoUrl={welcomeVideoUrl}>Watch intro</WelcomeVideoPopover>
        </div>
        {email && (
          <p className="mt-4 text-xs text-[var(--muted)]">
            Signed in as <span className="text-[var(--text)]">{email}</span>
          </p>
        )}
      </div>
    </section>
  );
}