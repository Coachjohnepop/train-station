"use client";

import { useEffect, useState } from "react";

export default function CoachInboxNavBadge({
  placement = "inline",
}: {
  placement?: "inline" | "corner";
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/admin/inbox?unread=1", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { unread?: number };
        if (!cancelled && typeof data.unread === "number") setCount(data.unread);
      } catch {
        /* ignore */
      }
    }

    void load();
    const id = window.setInterval(() => void load(), 15_000);
    window.addEventListener("coach-inbox-refresh", load);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("coach-inbox-refresh", load);
    };
  }, []);

  if (count <= 0) return null;

  return (
    <span
      className={
        placement === "corner"
          ? "absolute -right-1.5 -top-1.5 z-10 flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold leading-none text-black shadow-md ring-2 ring-[var(--bg)]"
          : "inline-flex h-[20px] min-w-[20px] shrink-0 translate-y-[-1px] items-center justify-center rounded-full bg-amber-400 px-1.5 text-[11px] font-bold leading-none text-black shadow-md ring-2 ring-[var(--surface)]"
      }
      aria-label={`${count} new alerts`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
