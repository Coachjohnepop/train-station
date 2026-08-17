"use client";

import { useState } from "react";
import Link from "next/link";
import YoutubeAutoplayFrame from "@/components/YoutubeAutoplayFrame";

/**
 * Join-page plan picker. Paid plans always go through /signup → /member/checkout
 * (same path as the landing tickets). Fee types: monthly subscription | one-time.
 */
const PLANS = [
  {
    id: "explorer",
    badge: "EXPLORER",
    title: "Free",
    price: "$0",
    priceNote: "No card required",
    feeLabel: null as string | null,
    perks: [
      "Access to select starter programs",
      "Basic workout logging & streaks",
      "Public program library",
    ],
    muted: ["Limited coach access", "No priority review"],
    quote:
      "Starting here is how every great athlete began. Build the habit small and watch it compound.",
    /** Optional coach video — leave null until Admin → Landing has a real URL. */
    video: null as string | null,
    popular: false,
  },
  {
    id: "member",
    badge: "COACH CLASS",
    title: "Coach Class",
    price: "$25",
    priceNote: "/mo",
    feeLabel: "Monthly subscription",
    perks: [
      "All programs — 4-week blocks",
      "15-min coach Zoom",
      "Set logging, streaks & home equipment",
      "In-app messages with your coach",
    ],
    muted: [] as string[],
    quote:
      "This is the plan where real accountability kicks in. The structure here turns effort into lasting results.",
    video: null as string | null,
    popular: true,
  },
  {
    id: "business",
    badge: "BUSINESS CLASS",
    title: "Business Class",
    price: "$50",
    priceNote: "/mo",
    feeLabel: "Monthly subscription",
    perks: [
      "Full member access",
      "Business billing",
      "Priority coach support",
    ],
    muted: [] as string[],
    quote: "Corporate and team memberships with full Train Station access.",
    video: null as string | null,
    popular: false,
  },
  {
    id: "pro",
    badge: "1ST CLASS",
    title: "1st Class",
    price: "$850",
    priceNote: "one-time",
    feeLabel: "One-time fee",
    perks: [
      "8 × 1-hour private sessions with Coach Byrd",
      "Use within 30 days",
      "Full 1st Class member access",
      "Live Zoom with John & Steph",
    ],
    muted: [] as string[],
    quote:
      "Eight focused sessions plus full access — the deepest level of support for serious athletes.",
    video: null as string | null,
    popular: false,
  },
] as const;

export default function PricingWithInlineSignup({ recParam }: { recParam?: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const isRecommended = (planId: string) =>
    (recParam || "").toLowerCase() === planId.toLowerCase() ||
    (recParam || "").toLowerCase() ===
      PLANS.find((p) => p.id === planId)?.title.toLowerCase();

  const selectedPlan = PLANS.find((p) => p.id === selected) ?? null;

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => {
          const active = selected === plan.id;
          const rec = isRecommended(plan.id);
          return (
            <div
              key={plan.id}
              onClick={() => setSelected(plan.id)}
              className={`relative flex cursor-pointer flex-col rounded-3xl border bg-[var(--surface)] p-8 transition-all hover:shadow-lg ${
                active
                  ? "scale-[1.01] border-[#7c3aed] ring-2 ring-[#7c3aed]"
                  : rec
                    ? "border-[#7c3aed] ring-1 ring-[#7c3aed]/40"
                    : plan.popular
                      ? "border-[#7c3aed]"
                      : "border-[var(--border)]"
              }`}
            >
              {plan.popular ? (
                <div className="absolute -top-3 right-6 rounded-full bg-[#7c3aed] px-3 py-0.5 text-xs font-semibold tracking-widest">
                  POPULAR
                </div>
              ) : null}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-xs font-semibold tracking-widest text-[#7c3aed]">
                    {plan.badge}
                  </div>
                  {rec ? (
                    <span className="rounded bg-[#7c3aed] px-2 py-0.5 text-[10px] font-semibold tracking-widest text-white">
                      RECOMMENDED
                    </span>
                  ) : null}
                  {active ? (
                    <span className="rounded bg-white px-2 py-0.5 text-[10px] font-semibold tracking-widest text-[#7c3aed]">
                      SELECTED
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-tight">{plan.price}</span>
                  {plan.priceNote ? (
                    <span className="text-[var(--muted)]">{plan.priceNote}</span>
                  ) : null}
                </div>
                {plan.feeLabel ? (
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-[var(--accent-fg)]">
                    {plan.feeLabel}
                  </p>
                ) : null}
              </div>
              <ul className="mt-8 flex-1 space-y-3 text-[15px]">
                {plan.perks.map((p) => (
                  <li key={p} className="flex gap-2">
                    ✓ {p}
                  </li>
                ))}
                {plan.muted.map((p) => (
                  <li key={p} className="flex gap-2 text-[var(--muted)]">
                    — {p}
                  </li>
                ))}
              </ul>

              <div className="mt-6 border-t border-[var(--border)] pt-4">
                <p className="mb-1 text-xs uppercase tracking-widest text-[#7c3aed]">
                  A message from the instructor
                </p>
                <p className="mb-3 text-sm italic text-[var(--muted)]">&ldquo;{plan.quote}&rdquo;</p>
                {plan.video ? (
                  <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
                    <YoutubeAutoplayFrame
                      className="h-full w-full"
                      videoUrl={plan.video}
                      title={`Instructor message for ${plan.title}`}
                      autoplay
                      kickPlayback
                    />
                  </div>
                ) : null}
              </div>

              <Link
                href={`/signup?plan=${encodeURIComponent(plan.id)}`}
                onClick={(e) => e.stopPropagation()}
                className={`mt-8 inline-flex h-11 items-center justify-center rounded-full text-sm font-semibold transition-all hover:scale-[1.05] ${
                  plan.popular
                    ? "bg-[#7c3aed] text-white hover:bg-[#6d2dd6]"
                    : "border border-[var(--border)] !text-[#7c3aed] hover:bg-white/5"
                }`}
              >
                {plan.id === "explorer" ? "Board free" : "Board this seat"}
              </Link>
              {plan.feeLabel === "Monthly subscription" ? (
                <p className="mt-2 text-center text-[10px] text-[var(--muted)]">
                  Billed monthly. Cancel anytime.
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {selectedPlan ? (
        <div
          id="inline-signup"
          className="mx-auto mt-8 max-w-2xl rounded-3xl border border-[#7c3aed] bg-[var(--surface)] p-8"
        >
          <div className="mb-6 text-center">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[3px] text-[#7c3aed]">
              Continue
            </div>
            <h3 className="text-2xl font-semibold tracking-tight">
              {selectedPlan.title}
              {selectedPlan.feeLabel ? (
                <span className="mt-1 block text-sm font-normal text-[var(--muted)]">
                  {selectedPlan.feeLabel} · {selectedPlan.price}
                  {selectedPlan.priceNote}
                </span>
              ) : null}
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {selectedPlan.id === "explorer"
                ? "Create a free account to explore starter programs."
                : "Sign up, then pay with Stripe (card). You’ll land in onboarding after payment."}
            </p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <Link
              href={`/signup?plan=${encodeURIComponent(selectedPlan.id)}`}
              className="inline-flex h-12 w-full max-w-md items-center justify-center rounded-full bg-[#7c3aed] text-sm font-semibold text-white hover:bg-[#6d2dd6]"
            >
              {selectedPlan.id === "explorer" ? "Continue free" : "Sign up & get your ticket"}
            </Link>
            <p className="text-center text-xs text-[var(--muted)]">
              Already have an account?{" "}
              <Link href="/login" className="text-[var(--accent-fg)] underline">
                Sign in
              </Link>
              {selectedPlan.id !== "explorer" ? (
                <>
                  {" "}
                  then open{" "}
                  <Link
                    href={`/member/checkout?plan=${encodeURIComponent(selectedPlan.id)}`}
                    className="text-[var(--accent-fg)] underline"
                  >
                    checkout
                  </Link>
                </>
              ) : null}
            </p>
          </div>
        </div>
      ) : null}

      <p className="mt-6 text-center text-xs text-[var(--muted)]">
        Prefer the main site flow?{" "}
        <Link href="/" className="text-[var(--accent-fg)] underline">
          Home tickets
        </Link>{" "}
        use the same checkout. Selecting a plan here opens signup — not a waitlist-only form.
      </p>
    </>
  );
}
