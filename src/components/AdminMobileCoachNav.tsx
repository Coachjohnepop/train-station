"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/admin/queue/count", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && typeof data.count === "number") setQueueCount(data.count);
      } catch {
        /* ignore */
      }
    }

    void load();
    const id = window.setInterval(() => void load(), 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const onQueue = pathname.startsWith("/admin/queue");
  const onAssign = pathname.startsWith("/admin/assign");
  const onLive = pathname.startsWith("/admin/live");
  const onChat = pathname.startsWith("/admin/chat");

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_92%,var(--surface))] backdrop-blur-md xl:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      aria-label="Coach quick nav"
    >
      <div className="mx-auto flex max-w-lg items-stretch">
        <Link href="/admin/queue" className={`relative ${tabClass(onQueue)}`}>
          <span className="text-base leading-none" aria-hidden>
            ◉
          </span>
          Queue
          {queueCount > 0 ? (
            <span className="absolute right-[calc(50%-1.25rem)] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-black">
              {queueCount > 9 ? "9+" : queueCount}
            </span>
          ) : null}
        </Link>
        <Link href="/admin/assign" className={tabClass(onAssign)}>
          <span className="text-base leading-none" aria-hidden>
            ⊕
          </span>
          Assign
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