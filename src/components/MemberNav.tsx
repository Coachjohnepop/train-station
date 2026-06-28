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

  return (
    <nav className="mx-auto flex w-full max-w-lg md:max-w-3xl lg:max-w-6xl xl:max-w-7xl gap-1 px-2 pb-2 md:px-6 lg:px-8 lg:justify-center">
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
        return (
          <Link
            key={item.href}
            id={isScoresTab ? "member-nav-scores" : undefined}
            href={item.href}
            className={`relative flex-1 lg:flex-none lg:px-6 rounded-lg py-2 text-center text-xs font-medium transition ${tabClass} ${
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
            {rampHighlight && !active ? (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--ramp-gold)] ring-2 ring-[var(--surface)]" />
            ) : null}
            {"badge" in item && item.badge ? <ChatNavBadge role="member" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}