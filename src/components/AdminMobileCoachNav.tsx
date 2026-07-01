"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
type Props = {
  onOpenMenu: () => void;
};

function tabClass(active: boolean): string {
  return `flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-semibold transition ${
    active ? "text-accent" : "text-[var(--muted)]"
  }`;
}

export default function AdminMobileCoachNav({ onOpenMenu }: Props) {
  const pathname = usePathname();

  const onClass = pathname.startsWith("/admin/day") || pathname === "/admin";
  const onPlan = pathname.startsWith("/admin/plan");
  const onLive = pathname.startsWith("/admin/live");
  const onChat = pathname.startsWith("/admin/chat");

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_92%,var(--surface))] backdrop-blur-md xl:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      aria-label="Coach quick nav"
    >
      <div className="mx-auto flex max-w-lg items-stretch">
        <Link href="/admin/day" className={tabClass(onClass)}>
          <span className="text-base leading-none" aria-hidden>
            ◉
          </span>
          Class
        </Link>
        <Link href="/admin/plan" className={tabClass(onPlan)}>
          <span className="text-base leading-none" aria-hidden>
            ⊕
          </span>
          Plan
        </Link>
        <Link href="/admin/live" className={tabClass(onLive)}>
          <span className="text-base leading-none" aria-hidden>
            ▣
          </span>
          Live
        </Link>
        <Link href="/admin/chat" className={tabClass(onChat)}>
          <span className="text-base leading-none" aria-hidden>
            ✉
          </span>
          Messages
        </Link>
        <button type="button" onClick={onOpenMenu} className={tabClass(false)}>
          <span className="text-base leading-none" aria-hidden>
            ☰
          </span>
          More
        </button>
      </div>
    </nav>
  );
}