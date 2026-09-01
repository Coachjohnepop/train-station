"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import ChatNavBadge from "@/components/ChatNavBadge";
import CoachInboxNavBadge from "@/components/CoachInboxNavBadge";
import PeopleAttentionBadge from "@/components/PeopleAttentionBadge";
import { openCoachHelpPanel } from "@/lib/coach-help-events";

type Props = {
  onOpenMenu: () => void;
};

function tabClass(active: boolean): string {
  return `coach-quick-nav-tab relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-semibold transition-colors ${
    active ? "coach-quick-nav-tab--active" : ""
  }`;
}

export default function AdminMobileCoachNav({ onOpenMenu }: Props) {
  const pathname = usePathname();
  const [coachHelp, setCoachHelp] = useState(false);

  useEffect(() => {
    fetch("/api/admin/help-chat", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.enabled) setCoachHelp(true);
      })
      .catch(() => {});
  }, []);

  const onDash = pathname.startsWith("/admin/day") || pathname === "/admin";
  const onToday = pathname.startsWith("/admin/today");
  const onLive = pathname.startsWith("/admin/live");
  const onPeople =
    pathname.startsWith("/admin/members") ||
    pathname.startsWith("/admin/leads") ||
    pathname.startsWith("/admin/alerts");
  const onAlerts = pathname.startsWith("/admin/alerts");
  const onChat = pathname.startsWith("/admin/chat");

  return (
    <nav
      className="coach-quick-nav fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_92%,var(--surface))] backdrop-blur-md xl:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      aria-label="Coach quick nav"
    >
      <div className="mx-auto flex max-w-lg items-stretch">
        <Link href="/admin/day" className={tabClass(onDash)}>
          <span className="coach-quick-nav-icon leading-none" aria-hidden>
            ◉
          </span>
          Board
        </Link>
        <Link href="/admin/today" className={tabClass(onToday)}>
          <span className="coach-quick-nav-icon leading-none" aria-hidden>
            ▶
          </span>
          Today
        </Link>
        {/* People: purple = new signups + leads. Red stays on Msgs only. */}
        <Link href="/admin/alerts" className={tabClass(onAlerts)}>
          <span className="relative inline-flex">
            <span className="coach-quick-nav-icon leading-none" aria-hidden>
              !
            </span>
            <CoachInboxNavBadge placement="corner" />
          </span>
          Alerts
        </Link>
        <Link href="/admin/members" className={tabClass(onPeople && !onAlerts)}>
          <span className="relative inline-flex">
            <span className="coach-quick-nav-icon leading-none" aria-hidden>
              ◎
            </span>
            <PeopleAttentionBadge placement="corner" />
          </span>
          People
        </Link>
        <Link href="/admin/chat" className={tabClass(onChat)}>
          <span className="relative inline-flex">
            <span className="coach-quick-nav-icon leading-none" aria-hidden>
              ✉
            </span>
            <ChatNavBadge role="coach" placement="corner" />
          </span>
          Msgs
        </Link>
        {coachHelp ? (
          <button
            type="button"
            onClick={openCoachHelpPanel}
            className={tabClass(false)}
            aria-label="Ask Grok for help using this app"
          >
            <span className="coach-quick-nav-icon leading-none" aria-hidden>
              ?
            </span>
            Grok
          </button>
        ) : null}
        <button type="button" onClick={onOpenMenu} className={tabClass(false)}>
          <span className="coach-quick-nav-icon leading-none" aria-hidden>
            ☰
          </span>
          More
        </button>
      </div>
    </nav>
  );
}