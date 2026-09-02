"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ChatNavBadge from "@/components/ChatNavBadge";
import UserBicepAvatar from "@/components/UserBicepAvatar";
import { goMemberTodayHome } from "@/lib/member-today-home";
import { memberCheckoutPath } from "@/lib/member-route-gates";
import type { SignupPlan } from "@/lib/signup-plans";
import {
  applyMemberTextScale,
  MEMBER_TEXT_SCALE_CHOICES,
  readMemberTextScale,
  type MemberTextScale,
} from "@/lib/member-text-scale";

type NavItem = {
  href: string;
  label: string;
  match: (p: string) => boolean;
  badge?: boolean;
  /** Still reachable while payment is pending (Messages, Book Call, Account). */
  openDuringPayment?: boolean;
};

const primaryItems: NavItem[] = [
  {
    href: "/member/today",
    label: "Today",
    match: (p: string) =>
      p !== "/member/checkout" &&
      (p === "/member/today" ||
        p === "/member/workout" ||
        p === "/member" ||
        p.startsWith("/member/programs")),
  },
  {
    href: "/member/chat",
    label: "Messages",
    match: (p: string) => p.startsWith("/member/chat"),
    badge: true,
    openDuringPayment: true,
  },
  {
    href: "/member/leaderboard",
    label: "Scores",
    match: (p: string) => p.startsWith("/member/leaderboard"),
  },
  {
    href: "/member/equipment",
    label: "Gear",
    match: (p: string) => p.startsWith("/member/equipment"),
  },
];

const moreItems: NavItem[] = [
  {
    href: "/member/measurements",
    label: "Measure",
    match: (p: string) => p.startsWith("/member/measurements"),
  },
  {
    href: "/member/sponsorship",
    label: "Partners",
    match: (p: string) => p.startsWith("/member/sponsorship"),
  },
  {
    href: "/member/book",
    label: "Book Call",
    match: (p: string) => p.startsWith("/member/book"),
    openDuringPayment: true,
  },
  {
    href: "/member/account",
    label: "Account",
    match: (p: string) => p.startsWith("/member/account"),
    openDuringPayment: true,
  },
];

function navHref(item: NavItem, paymentGateActive: boolean, checkoutPlan: SignupPlan): string {
  if (!paymentGateActive || item.openDuringPayment) return item.href;
  return memberCheckoutPath(checkoutPlan);
}

function homeIcon() {
  return (
    <svg
      className="member-nav-home-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </svg>
  );
}

function lockIcon() {
  return (
    <svg
      className="member-nav-lock-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export default function MemberNav({
  intakePending = false,
  paymentGateActive = false,
  checkoutPlan = "member",
}: {
  intakePending?: boolean;
  paymentGateActive?: boolean;
  checkoutPlan?: SignupPlan;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [scorePoints, setScorePoints] = useState<number | null>(null);
  const [scorePulse, setScorePulse] = useState(false);
  const [textScale, setTextScale] = useState<MemberTextScale>("md");

  useEffect(() => {
    const scale = readMemberTextScale();
    setTextScale(scale);
    applyMemberTextScale(scale);
  }, []);

  const refreshScore = useCallback(async () => {
    try {
      const res = await fetch("/api/member/gamification", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.totalPoints === "number") setScorePoints(data.totalPoints);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshScore();
  }, [refreshScore]);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false);
    }
    function onPointer(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [moreOpen]);

  useEffect(() => {
    function onScoreUpdated(e: Event) {
      const custom = e as CustomEvent<{ totalPoints?: number }>;
      const total = custom.detail?.totalPoints;
      if (typeof total === "number") {
        setScorePoints(total);
        setScorePulse(true);
        window.setTimeout(() => setScorePulse(false), 1200);
      } else {
        void refreshScore();
      }
    }
    window.addEventListener("member-score-updated", onScoreUpdated);
    return () => window.removeEventListener("member-score-updated", onScoreUpdated);
  }, [refreshScore]);

  const onCheckout = pathname.startsWith("/member/checkout");
  const moreActive = !onCheckout && moreItems.some((item) => item.match(pathname));

  function tabClass(active: boolean, rampHighlight: boolean) {
    if (rampHighlight) {
      return active ? "nav-tab-ramp-active font-semibold" : "nav-tab-ramp font-semibold";
    }
    return active
      ? "nav-tab-active text-accent"
      : "text-[var(--muted)] hover:bg-[var(--surface-2)]";
  }

  return (
    <div ref={wrapRef} className="member-nav-wrap relative">
      <nav
        className="member-nav mx-auto flex w-full max-w-lg items-stretch gap-1 px-2 pb-2.5 md:max-w-3xl md:px-6 lg:max-w-6xl lg:justify-center lg:px-8 xl:max-w-7xl"
        aria-label="Member dashboard"
      >
        {primaryItems.map((item) => {
          const href = navHref(item, paymentGateActive, checkoutPlan);
          const locked = paymentGateActive && !item.openDuringPayment;
          const active = !onCheckout && item.match(pathname);
          const isTodayTab = item.href === "/member/today";
          const isScoresTab = item.href === "/member/leaderboard";
          const isGearTab = item.href === "/member/equipment";
          const rampHighlight = intakePending && isTodayTab && !locked;

          if (isTodayTab) {
            return (
              <Link
                key={item.href}
                id="member-nav-today"
                href={href}
                aria-label={locked ? "Today — complete your ticket first" : "Home — Today dashboard"}
                title={locked ? "Complete your ticket to unlock Today" : "Home — your daily dashboard"}
                onClick={(e) => {
                  if (locked) return;
                  e.preventDefault();
                  goMemberTodayHome(router);
                }}
                className={`member-nav-home member-nav-home--ramp relative flex min-h-10 flex-[1.05] flex-row items-center justify-center gap-1 rounded-xl border px-1.5 py-1 text-center transition lg:min-h-[2.75rem] lg:min-w-[3.2rem] lg:max-w-[5.5rem] lg:flex-[0.67] lg:px-2 ${
                  active ? "member-nav-home--active nav-tab-ramp-active" : "nav-tab-ramp"
                } ${locked ? "opacity-80" : ""}`}
              >
                {homeIcon()}
                <span className="member-nav-home-label">{item.label}</span>
                <span className="member-nav-home-sublabel hidden lg:inline">Home</span>
                {rampHighlight && !active ? (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--ramp-gold)] ring-2 ring-[var(--surface)]" />
                ) : null}
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              id={
                isScoresTab ? "member-nav-scores" : isGearTab ? "member-nav-gear" : undefined
              }
              href={href}
              title={
                locked
                  ? "Complete your ticket to unlock"
                  : isGearTab
                    ? "Gear shop — browse & buy equipment"
                    : undefined
              }
              className={`member-nav-item relative flex min-h-10 flex-1 flex-col items-center justify-center rounded-lg px-1 py-1 text-center text-sm font-semibold leading-tight tracking-tight transition sm:text-base lg:min-h-[2.75rem] lg:flex-none lg:min-w-[4.75rem] lg:px-5 ${tabClass(
                active,
                false,
              )} ${isScoresTab && scorePulse ? "member-nav-score-pulse" : ""} ${
                locked ? "opacity-75" : ""
              }`}
            >
              {item.label}
              {locked ? lockIcon() : null}
              {isScoresTab && scorePoints != null && scorePoints > 0 ? (
                <span
                  className={`member-nav-score-badge ${scorePulse ? "member-nav-score-badge--pulse" : ""}`}
                >
                  {scorePoints}
                </span>
              ) : null}
              {"badge" in item && item.badge ? (
                <ChatNavBadge role="member" placement="corner" />
              ) : null}
            </Link>
          );
        })}

        <button
          type="button"
          id="member-nav-more"
          aria-expanded={moreOpen}
          aria-controls="member-nav-more-panel"
          aria-label={moreOpen ? "Close menu" : "Open menu"}
          title="More"
          onClick={() => setMoreOpen((open) => !open)}
          className={`member-nav-item relative flex min-h-10 flex-[0.9] flex-col items-center justify-center rounded-lg px-1 py-1 text-center text-sm font-semibold leading-tight tracking-tight transition sm:text-base lg:min-h-[2.75rem] lg:flex-none lg:min-w-[4.25rem] lg:px-4 ${tabClass(
            moreActive || moreOpen,
            false,
          )}`}
        >
          <span className="member-nav-more-icon" aria-hidden>
            {moreOpen ? "✕" : "☰"}
          </span>
          <span>More</span>
        </button>
      </nav>

      {moreOpen ? (
        <div
          id="member-nav-more-panel"
          className="member-nav-more-panel"
          aria-label="More member pages"
        >
          <div
            className="member-text-scale"
            role="group"
            aria-label="Text size"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span className="member-text-scale__label">Text</span>
            {MEMBER_TEXT_SCALE_CHOICES.map(({ id, label, title }) => (
              <button
                key={id}
                type="button"
                title={title}
                data-scale={id}
                aria-pressed={textScale === id}
                className={`member-text-scale__btn ${
                  textScale === id ? "member-text-scale__btn--on" : ""
                }`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setTextScale(id);
                  applyMemberTextScale(id);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {moreItems.map((item) => {
            const href = navHref(item, paymentGateActive, checkoutPlan);
            const locked = paymentGateActive && !item.openDuringPayment;
            const active = !onCheckout && item.match(pathname);
            const isAccountTab = item.href === "/member/account";
            return (
              <Link
                key={item.href}
                href={href}
                onClick={() => setMoreOpen(false)}
                className={`member-nav-more-link ${active ? "member-nav-more-link--active" : ""} ${
                  locked ? "opacity-75" : ""
                }`}
              >
                {isAccountTab ? <UserBicepAvatar size={22} title="Account" /> : null}
                <span>{item.label}</span>
                {locked ? <span aria-hidden>🔒</span> : null}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
