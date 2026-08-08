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
import { formatMembershipPaymentStatus, type MemberMembershipSnapshot } from "@/lib/member-membership";
import { signupPlanLabel } from "@/lib/signup-plans";

/** Every ticket class has dedicated seat photography. */
const TICKET_ID_BY_PLAN = {
  explorer: "free",
  member: "coach-class",
  business: "business-class",
  pro: "first-class",
} as const;

/** Matched pair — same height/padding so Watch intro + Today sit level on mobile. */
const CTA_BASE =
  "inline-flex h-14 w-full min-w-0 flex-1 items-center justify-center rounded-full px-6 text-sm font-bold transition-all active:scale-[0.98] sm:min-w-[10.5rem] sm:flex-none sm:px-10";

const CTA_INTRO = `${CTA_BASE} bg-[#7c3aed] text-white shadow-lg shadow-[#7c3aed]/30 hover:bg-[#6d2dd6] hover:scale-[1.02]`;

const CTA_TODAY = `${CTA_BASE} border-2 border-amber-300/80 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 text-amber-950 shadow-lg shadow-amber-500/35 hover:from-amber-200 hover:to-amber-500 hover:scale-[1.02]`;

export default function LandingMemberStatus({
  membership,
  displayName,
  email,
  welcomeVideoUrl = null,
}: {
  membership: MemberMembershipSnapshot;
  displayName?: string;
  email?: string;
  welcomeVideoUrl?: string | null;
}) {
  const themeTier = membershipThemeTierFromPlan(membership.plan);
  const planLabel = signupPlanLabel(membership.plan);
  const statusLabel = formatMembershipPaymentStatus(membership);
  const isFree = membership.plan === "explorer";
  const ticketId =
    TICKET_ID_BY_PLAN[membership.plan as keyof typeof TICKET_ID_BY_PLAN] ?? "free";
  const seatArt = seatArtForPlan(membership.plan) || seatArtForPlan("explorer");
  const tierLabel = MEMBERSHIP_THEME_LABELS[themeTier];

  return (
    <section
      id="membership"
      className="relative z-20 isolate scroll-mt-20 border-b border-[var(--border)] bg-[var(--bg)] shadow-[0_-12px_32px_var(--bg)]"
    >
      {/*
        Seat photography hero — fills the welcome band only.
        Fades out before Watch intro / Today so those CTAs sit on solid page bg.
      */}
      <div className="relative overflow-hidden">
        {seatArt && ticketId ? (
          <>
            <MembershipSeatArt
              ticketId={ticketId}
              className="pointer-events-none absolute inset-0 h-full w-full scale-105 object-cover object-center"
              alt=""
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

        <div className="force-dark relative z-10 mx-auto max-w-4xl px-3 pb-6 pt-10 text-center sm:px-6 sm:pb-8 sm:pt-14" data-force-dark>
          <TrainStationBrand variant="compact" className="mb-5 brightness-110 drop-shadow-md" />

          {displayName ? (
            <h1 className="text-3xl font-semibold tracking-tight text-white drop-shadow-md sm:text-4xl">
              Welcome back, {displayName}.
            </h1>
          ) : (
            <h1 className="text-3xl font-semibold tracking-tight text-white drop-shadow-md sm:text-4xl">
              Welcome back.
            </h1>
          )}

          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.28em] text-amber-200/90">
            Your membership
          </p>

          {/* Plan name is the star — e.g. Business Class */}
          <p
            className="mt-2 font-serif text-3xl font-bold tracking-tight text-amber-300 drop-shadow-[0_2px_12px_rgba(251,191,36,0.35)] sm:text-4xl md:text-5xl"
            style={{ textShadow: "0 2px 24px rgba(0,0,0,0.55)" }}
          >
            {isFree ? "Explorer" : planLabel}
          </p>

          {!isFree ? (
            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-white/85">
              You&apos;re already on board
            </p>
          ) : (
            <p className="mt-2 text-sm font-semibold text-white/85">Starter access</p>
          )}

          {/* Real membership payment/approval status only — no price or instructional blurb */}
          <p className="mt-3 text-sm font-medium text-white/70">
            Status: <span className="font-semibold text-white">{statusLabel}</span>
          </p>
        </div>
      </div>

      {/* CTAs sit on page background — not over the seat photo */}
      <div className="relative z-10 mx-auto max-w-4xl px-3 pb-10 pt-1 text-center sm:px-6 sm:pb-14">
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
            <a href="/member/today" className={CTA_TODAY}>
              Today
            </a>
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

        <div className="mx-auto mt-6 flex max-w-md flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
          <MemberDashboardLink className="btn-secondary w-full px-8 sm:w-auto">
            Open Dashboard
          </MemberDashboardLink>
          <Link href="/member/account" className="btn-secondary w-full px-8 sm:w-auto">
            Account &amp; billing
          </Link>
        </div>

        {email ? (
          <p className="mt-4 text-xs text-[var(--muted)]">
            Signed in as <span className="text-[var(--text)]">{email}</span>
          </p>
        ) : null}

        {/* Compact ticket recap (seat art already used in hero) */}
        <div className="mx-auto mt-8 max-w-sm sm:max-w-md">
          <div
            className={`relative isolate flex min-h-[160px] flex-col overflow-hidden rounded-2xl border text-left shadow-lg ticket-card ticket-card--${
              ticketId ?? "free"
            }`}
          >
            {seatArt && ticketId ? (
              <MembershipSeatArt ticketId={ticketId} className="ticket-card__art" />
            ) : (
              <div className="ticket-card__art bg-gradient-to-br from-zinc-700/40 to-zinc-900/60" />
            )}
            <div className="ticket-card__body relative z-10">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                {tierLabel}
              </div>
              <div className="mt-1 text-2xl font-bold leading-tight text-white sm:text-3xl">
                {planLabel}
              </div>
              <p className="mt-2 text-sm text-white/80">
                Status: <span className="font-semibold text-white">{statusLabel}</span>
              </p>
            </div>
          </div>
        </div>

        {membership.switchablePlans.length > 0 ? (
          <div className="mx-auto mt-8 max-w-lg rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/8 px-4 py-4 text-center sm:px-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
              Upgrade your ticket
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Move up a class without creating a new account.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {membership.switchablePlans.map((plan) => (
                <Link
                  key={plan}
                  href={`/member/checkout?plan=${plan}`}
                  className="btn-secondary text-xs sm:text-sm"
                >
                  {signupPlanLabel(plan)}
                </Link>
              ))}
            </div>
          </div>
        ) : isFree ? (
          <div className="mx-auto mt-8 max-w-lg rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/8 px-4 py-4 text-center sm:px-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
              Ready for the full ride?
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link href="/member/checkout?plan=member" className="btn-primary text-xs sm:text-sm">
                Coach Class
              </Link>
              <Link href="/member/checkout?plan=business" className="btn-secondary text-xs sm:text-sm">
                Business Class
              </Link>
              <Link href="/member/checkout?plan=pro" className="btn-secondary text-xs sm:text-sm">
                1st Class
              </Link>
            </div>
          </div>
        ) : null}

        <div className="mx-auto mt-6 flex max-w-md flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/join/questions"
            className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] hover:underline"
          >
            Not sure? 1-minute assessment →
          </Link>
        </div>
      </div>
    </section>
  );
}
