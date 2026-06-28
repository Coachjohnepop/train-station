"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ChatNavBadge from "@/components/ChatNavBadge";

const items = [
  {
    href: "/member/today",
    label: "Today",
    match: (p: string) =>
      p === "/member/today" ||
      p === "/member/workout" ||
      p === "/member" ||
      p.startsWith("/member/programs"),
  },
  {
    href: "/member/chat",
    label: "Messages",
    match: (p: string) => p.startsWith("/member/chat"),
    badge: true,
  },
  {
    href: "/member/leaderboard",
    label: "Scores",
    match: (p: string) => p.startsWith("/member/leaderboard"),
  },
  {
    href: "/member/book",
    label: "Book Call",
    match: (p: string) => p.startsWith("/member/book"),
  },
  {
    href: "/member/account",
    label: "Account",
    match: (p: string) => p.startsWith("/member/account"),
  },
];

export default function MemberNav({ intakePending = false }: { intakePending?: boolean }) {
  const pathname = usePathname();
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
        const active = item.match(pathname);
        const isTodayTab = item.href === "/member/today";
        const isScoresTab = item.href === "/member/leaderboard";
        const rampHighlight = intakePending && isTodayTab;
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
              href={item.href}
              aria-label="Home — Today dashboard"
              title="Home — your daily dashboard"
              className={`member-nav-home relative flex flex-[2] flex-col items-center justify-center rounded-xl border text-center transition lg:min-w-[9.5rem] lg:px-8 ${
                rampHighlight
                  ? active
                    ? "member-nav-home--ramp member-nav-home--active nav-tab-ramp-active"
                    : "member-nav-home--ramp nav-tab-ramp"
                  : active
                    ? "member-nav-home--active nav-tab-active"
                    : "member-nav-home--idle border-[var(--border)]"
              }`}
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

        return (
          <Link
            key={item.href}
            id={isScoresTab ? "member-nav-scores" : undefined}
            href={item.href}
            className={`member-nav-item relative flex flex-1 flex-col items-center justify-center rounded-lg px-1 py-2 text-center text-[10px] font-medium transition sm:text-xs lg:flex-none lg:min-w-[4.75rem] lg:px-5 ${tabClass} ${
              isScoresTab && scorePulse ? "member-nav-score-pulse" : ""
            }`}
          >
            {item.label}
            {isScoresTab && scorePoints != null && scorePoints > 0 ? (
              <span
                className={`member-nav-score-badge ${scorePulse ? "member-nav-score-badge--pulse" : ""}`}
              >
                {scorePoints}
              </span>
            ) : null}
            {"badge" in item && item.badge ? <ChatNavBadge role="member" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}