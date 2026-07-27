"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ChatNavBadge from "@/components/ChatNavBadge";
import UserBicepAvatar from "@/components/UserBicepAvatar";
import { goMemberTodayHome } from "@/lib/member-today-home";
import { memberCheckoutPath } from "@/lib/member-route-gates";
import type { SignupPlan } from "@/lib/signup-plans";

type NavItem = {
  href: string;
  label: string;
  match: (p: string) => boolean;
  badge?: boolean;
  /** Still reachable while payment is pending (Messages, Book Call, Account). */
  openDuringPayment?: boolean;
};

const items: NavItem[] = [
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
  const [scorePoints, setScorePoints] = useState<number | null>(null);
  const [scorePulse, setScorePulse] = useState(false);

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

  return (
    <nav
      className="member-nav mx-auto flex w-full max-w-lg items-stretch md:max-w-3xl lg:max-w-6xl xl:max-w-7xl gap-1 px-2 pb-2 md:px-6 lg:px-8 lg:justify-center"
      aria-label="Member dashboard"
    >
      {items.map((item) => {
        const href = navHref(item, paymentGateActive, checkoutPlan);
        const locked = paymentGateActive && !item.openDuringPayment;
        const onCheckout = pathname.startsWith("/member/checkout");
        const active = !onCheckout && item.match(pathname);
        const isTodayTab = item.href === "/member/today";
        const isScoresTab = item.href === "/member/leaderboard";
        const rampHighlight = intakePending && isTodayTab && !locked;
        const tabClass = rampHighlight
          ? active
            ? "nav-tab-ramp-active font-semibold"
            : "nav-tab-ramp font-semibold"
          : active
            ? "nav-tab-active text-accent"
            : "text-[var(--muted)] hover:bg-[var(--surface-2)]";

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
              className={`member-nav-home member-nav-home--ramp relative flex flex-[0.67] flex-col items-center justify-center rounded-xl border text-center transition lg:min-w-[3.2rem] lg:max-w-[4.5rem] lg:px-2 ${
                active ? "member-nav-home--active nav-tab-ramp-active" : "nav-tab-ramp"
              } ${locked ? "opacity-80" : ""}`}
            >
              {homeIcon()}
              <span className="member-nav-home-label">{item.label}</span>
              <span className="member-nav-home-sublabel">Home</span>
              {rampHighlight && !active ? (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--ramp-gold)] ring-2 ring-[var(--surface)]" />
              ) : null}
            </Link>
          );
        }

        const isAccountTab = item.href === "/member/account";
        const isGearTab = item.href === "/member/equipment";

        return (
          <Link
            key={item.href}
            id={
              isScoresTab
                ? "member-nav-scores"
                : isGearTab
                  ? "member-nav-gear"
                  : undefined
            }
            href={href}
            title={
              locked
                ? "Complete your ticket to unlock"
                : isGearTab
                  ? "Gear shop — browse & buy equipment"
                  : undefined
            }
            className={`member-nav-item relative flex flex-1 flex-col items-center justify-center rounded-lg px-1 py-2 text-center text-[10px] font-medium transition sm:text-xs lg:flex-none lg:min-w-[4.75rem] lg:px-5 ${tabClass} ${
              isScoresTab && scorePulse ? "member-nav-score-pulse" : ""
            } ${locked ? "opacity-75" : ""}`}
          >
            {isAccountTab ? (
              <span className="mb-0.5 inline-flex">
                <UserBicepAvatar size={22} title="Account" />
              </span>
            ) : null}
            {item.label}
            {locked ? (
              <span className="absolute -right-0.5 -top-0.5 text-[8px] leading-none opacity-70" aria-hidden>
                🔒
              </span>
            ) : null}
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
    </nav>
  );
}