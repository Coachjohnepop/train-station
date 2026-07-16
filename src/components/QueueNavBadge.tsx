"use client";

import { useEffect, useState } from "react";

export default function QueueNavBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/admin/queue/count", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && typeof data.count === "number") setCount(data.count);
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

  if (count <= 0) return null;

  return (
    <span
      className="inline-flex h-[18px] min-w-[18px] shrink-0 translate-y-[-1px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-none text-black shadow-sm ring-2 ring-[var(--surface)]"
      aria-label={`${count} queue items`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}