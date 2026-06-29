import Link from "next/link";
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

const TICKET_ID_BY_PLAN = {
  member: "coach-class",
  business: "business-class",
  pro: "first-class",
} as const;

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
  const ticketId = TICKET_ID_BY_PLAN[membership.plan as keyof typeof TICKET_ID_BY_PLAN];
  const seatArt = seatArtForPlan(membership.plan);

  return (
    <section
      id="membership"
      className="relative z-20 isolate scroll-mt-20 border-b border-[var(--border)] bg-[var(--bg)] px-3 py-10 shadow-[0_-12px_32px_var(--bg)] sm:px-6 sm:py-14"
    >
      <div className="mx-auto max-w-4xl text-center">
        <TrainStationBrand variant="compact" className="mb-6" />
        {displayName ? (
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Welcome back, {displayName}.
          </h1>
        ) : null}
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--accent)] mt-6">
          Your membership
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
          {isFree ? "Explorer — starter access" : "You're already on board"}
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-[var(--muted)]">
          {isFree
            ? "Sample the station, then upgrade when you are ready for daily coach workouts and live sessions."
            : `Your ${planLabel} ticket is active. Open your dashboard for today’s workout, messages, and scores.`}
        </p>
        {welcomeVideoUrl ? (
          <div className="mt-4 flex justify-center">
            <WelcomeVideoPopover welcomeVideoUrl={welcomeVideoUrl}>Watch intro</WelcomeVideoPopover>
          </div>
        ) : null}
        {email ? (
          <p className="mt-4 text-xs text-[var(--muted)]">
            Signed in as <span className="text-[var(--text)]">{email}</span>
          </p>
        ) : null}
      </div>

      <div className="mx-auto mt-8 max-w-sm sm:max-w-md">
        <div
          className={`relative isolate flex min-h-[240px] flex-col overflow-hidden rounded-2xl border text-left shadow-lg ticket-card ticket-card--${
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
              {MEMBERSHIP_THEME_LABELS[themeTier]}
            </div>
            <div className="mt-1 text-xl font-bold leading-tight text-white sm:text-2xl">{planLabel}</div>
            {membership.priceDisplay ? (
              <div className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
                {membership.priceDisplay}
              </div>
            ) : null}
            <p className="mt-3 text-sm text-white/80">
              Status: <span className="font-semibold text-white">{statusLabel}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-6 flex max-w-md flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link href="/member" className="btn-primary px-8">
          Open dashboard
        </Link>
        <Link href="/member/account" className="btn-secondary px-8">
          Account &amp; billing
        </Link>
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
    </section>
  );
}