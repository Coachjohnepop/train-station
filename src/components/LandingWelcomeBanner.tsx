"use client";

import Link from "next/link";
import MemberDashboardLink from "@/components/MemberDashboardLink";
import WelcomeVideoPopover from "@/components/WelcomeVideoPopover";

export default function LandingWelcomeBanner({
  displayName,
  email,
  isCoach,
  membershipPlan = null,
  membershipPlanLabel = null,
  isEstablishedMember = false,
  welcomeVideoUrl = null,
}: {
  displayName: string;
  email?: string;
  isCoach?: boolean;
  membershipPlan?: string | null;
  membershipPlanLabel?: string | null;
  isEstablishedMember?: boolean;
  welcomeVideoUrl?: string | null;
}) {
  const programHref = isCoach ? "/admin" : "/member";
  const isFreeTier = !isCoach && membershipPlan === "explorer";

  function subtitle(): string {
    if (isCoach) return "Your coach tools and member roster are ready.";
    if (isEstablishedMember && membershipPlanLabel) {
      return isFreeTier
        ? `You're on ${membershipPlanLabel} (free) — sample the station, then upgrade when you're ready for daily coach workouts and live sessions.`
        : `You're on ${membershipPlanLabel} — your programs, coach thread, and workouts are ready.`;
    }
    if (isFreeTier) {
      return "You're on Explorer (free) — sample the station, then upgrade when you're ready for daily coach workouts and live sessions.";
    }
    return "Your programs, progress, and workouts are ready — open the dashboard or compare memberships anytime.";
  }

  return (
    <section className="border-b border-[var(--border)] px-4 py-10 text-center sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Welcome back, {displayName}.
        </h1>
        <p className="mt-3 text-base text-[var(--muted)] sm:text-lg">{subtitle()}</p>

        {welcomeVideoUrl?.trim() ? (
          <div className="mt-6 flex flex-col items-center gap-2">
            <WelcomeVideoPopover welcomeVideoUrl={welcomeVideoUrl}>
              Watch intro
            </WelcomeVideoPopover>
            <a
              href={welcomeVideoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent hover:underline"
            >
              YouTube link →
            </a>
          </div>
        ) : null}

        <div className="mt-6 flex justify-center">
          {isCoach ? (
            <Link href={programHref} className="btn-primary w-full max-w-xs px-8 sm:w-auto">
              Coach admin
            </Link>
          ) : (
            <MemberDashboardLink className="btn-primary w-full max-w-xs px-8 sm:w-auto">
              {isFreeTier ? "Open free dashboard" : "Open Dashboard"}
            </MemberDashboardLink>
          )}
        </div>

        {isFreeTier && !isEstablishedMember && (
          <div className="mt-6 rounded-2xl border border-[#7c3aed]/35 bg-[#7c3aed]/10 px-4 py-4 text-left sm:px-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c4b5fd]">
              Ready for the full ride?
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text)]">
              Coach Class adds daily workouts, your private coach Messages thread (app badge), and scheduling with
              Jeremy. Business Class and 1st Class unlock more live coaching and priority support.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Link href="/member/checkout?plan=member" className="btn-primary text-xs sm:text-sm">
                Upgrade to Coach Class
              </Link>
              <Link href="/member/checkout?plan=business" className="btn-secondary text-xs sm:text-sm">
                Business Class
              </Link>
              <Link href="/member/checkout?plan=pro" className="btn-secondary text-xs sm:text-sm">
                1st Class
              </Link>
            </div>
            <p className="mt-3 text-[11px] text-[var(--muted)]">
              Same account — no need to sign up again.{" "}
              <Link href="/join" className="text-accent hover:underline">
                Compare memberships
              </Link>
              .
            </p>
          </div>
        )}

        {email && (
          <p className="mt-4 text-xs text-[var(--muted)]">
            Signed in as <span className="text-[var(--text)]">{email}</span>
            {membershipPlanLabel ? (
              <>
                {" "}
                · <span className="text-[#c4b5fd]">{membershipPlanLabel}</span>
              </>
            ) : null}
          </p>
        )}
      </div>
    </section>
  );
}