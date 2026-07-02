"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { openCoachHelpPanel } from "@/lib/coach-help-events";

type Props = {
  onOpenMenu: () => void;
};

function tabClass(active: boolean): string {
  return `coach-quick-nav-tab flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-semibold transition-colors ${
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
  const onPlan = pathname.startsWith("/admin/plan");
  const onLive = pathname.startsWith("/admin/live");
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
        <Link href="/admin/plan" className={tabClass(onPlan)}>
          <span className="coach-quick-nav-icon leading-none" aria-hidden>
            ⊕
          </span>
          Plan
        </Link>
        <Link href="/admin/live" className={tabClass(onLive)}>
          <span className="coach-quick-nav-icon leading-none" aria-hidden>
            ▣
          </span>
          Live
        </Link>
        <Link href="/admin/chat" className={tabClass(onChat)}>
          <span className="coach-quick-nav-icon leading-none" aria-hidden>
            ✉
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