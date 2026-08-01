"use client";

import Link from "next/link";
import MemberDashboardLink from "@/components/MemberDashboardLink";
import MembershipSeatArt from "@/components/MembershipSeatArt";
import TrainStationBrand from "@/components/TrainStationBrand";
import WelcomeVideoPopover from "@/components/WelcomeVideoPopover";
import {
  MEMBERSHIP_THEME_LABELS,
  membershipThemeTierFromPlan,
  seatArtForPlan,
} from "@/lib/membership-theme";
import { signupPlanLabel, type SignupPlan } from "@/lib/signup-plans";

const TICKET_ID_BY_PLAN = {
  explorer: "free",
  member: "coach-class",
  business: "business-class",
  pro: "first-class",
} as const;

const CTA_BASE =
  "inline-flex h-14 w-full min-w-0 flex-1 items-center justify-center rounded-full px-6 text-sm font-bold transition-all active:scale-[0.98] sm:min-w-[10.5rem] sm:flex-none sm:px-10";

const CTA_INTRO = `${CTA_BASE} bg-[#7c3aed] text-white shadow-lg shadow-[#7c3aed]/30 hover:bg-[#6d2dd6] hover:scale-[1.02]`;

const CTA_TODAY = `${CTA_BASE} border-2 border-amber-300/80 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 text-amber-950 shadow-lg shadow-amber-500/35 hover:from-amber-200 hover:to-amber-500 hover:scale-[1.02]`;

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
  const plan = (membershipPlan || "explorer") as SignupPlan;
  const isFreeTier = !isCoach && plan === "explorer";
  const themeTier = membershipThemeTierFromPlan(plan);
  const planLabel =
    membershipPlanLabel?.trim() ||
    (isCoach ? "Coach" : signupPlanLabel(plan));
  const ticketId =
    TICKET_ID_BY_PLAN[plan as keyof typeof TICKET_ID_BY_PLAN] ?? "free";
  const seatArt = !isCoach
    ? seatArtForPlan(plan) || seatArtForPlan("explorer")
    : null;

  function heroSubcopy(): string {
    if (isCoach) return "Your coach tools and member roster are ready.";
    if (isFreeTier) {
      return "Sample the station, then upgrade when you're ready for daily coach workouts and live sessions.";
    }
    return `Your ${planLabel} ticket is active. Tap Today for this session’s workout, or watch the intro anytime.`;
  }

  return (
    <section className="relative z-20 isolate border-b border-[var(--border)] bg-[var(--bg)]">
      {/* Seat art hero for every membership ticket class (Coach uses solid band). */}
      <div className="relative overflow-hidden">
        {seatArt ? (
          <>
            <MembershipSeatArt
              ticketId={ticketId}
              className="pointer-events-none absolute inset-0 h-full w-full scale-105 object-cover object-center"
              alt=""
              priority
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-[var(--bg)]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[var(--bg)] to-transparent sm:h-28"
              aria-hidden
            />
          </>
        ) : (
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#1a0b2e] via-[#12081f] to-[var(--bg)]"
            aria-hidden
          />
        )}

        <div className="relative z-10 mx-auto max-w-4xl px-3 pb-6 pt-10 text-center sm:px-6 sm:pb-8 sm:pt-14">
          <TrainStationBrand variant="compact" className="mb-5 brightness-110 drop-shadow-md" />
          <h1 className="text-3xl font-semibold tracking-tight text-white drop-shadow-md sm:text-4xl">
            Welcome back, {displayName}.
          </h1>

          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.28em] text-amber-200/90">
            {isCoach ? "Coach access" : "Your membership"}
          </p>

          <p
            className="mt-2 font-serif text-3xl font-bold tracking-tight text-amber-300 drop-shadow-[0_2px_12px_rgba(251,191,36,0.35)] sm:text-4xl md:text-5xl"
            style={{ textShadow: "0 2px 24px rgba(0,0,0,0.55)" }}
          >
            {planLabel}
          </p>

          {!isCoach ? (
            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-white/85">
              {isFreeTier
                ? "Starter access"
                : isEstablishedMember
                  ? "You're already on board"
                  : MEMBERSHIP_THEME_LABELS[themeTier]}
            </p>
          ) : (
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/75">
              {heroSubcopy()}
            </p>
          )}
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-3 pb-10 pt-1 text-center sm:px-6 sm:pb-12">
        {welcomeVideoUrl?.trim() || !isCoach ? (
          <div className="mx-auto flex max-w-md flex-col items-center gap-2">
            <div className="flex w-full flex-row items-stretch justify-center gap-2.5 sm:gap-3">
              {welcomeVideoUrl?.trim() ? (
                <WelcomeVideoPopover
                  welcomeVideoUrl={welcomeVideoUrl}
                  buttonClassName={CTA_INTRO}
                  className="min-w-0 flex-1 sm:flex-none"
                >
                  Watch intro
                </WelcomeVideoPopover>
              ) : null}
              {!isCoach ? (
                <a href="/member/today" className={CTA_TODAY}>
                  Today
                </a>
              ) : null}
            </div>
            {welcomeVideoUrl?.trim() ? (
              <a
                href={welcomeVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent hover:underline"
              >
                YouTube link →
              </a>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 flex justify-center">
          {isCoach ? (
            <Link href={programHref} className="btn-primary w-full max-w-xs px-8 sm:w-auto">
              Coach admin
            </Link>
          ) : (
            <MemberDashboardLink className="btn-secondary w-full max-w-xs px-8 sm:w-auto">
              {isFreeTier ? "Open free dashboard" : "Open Dashboard"}
            </MemberDashboardLink>
          )}
        </div>

        {isFreeTier && !isEstablishedMember && (
          <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-[#7c3aed]/35 bg-[#7c3aed]/10 px-4 py-4 text-left sm:px-5">
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
            {planLabel ? (
              <>
                {" "}
                · <span className="text-amber-200/90">{planLabel}</span>
              </>
            ) : null}
          </p>
        )}
      </div>
    </section>
  );
}
