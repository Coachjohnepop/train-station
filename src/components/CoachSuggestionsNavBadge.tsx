"use client";

import { useEffect, useState } from "react";

export default function CoachSuggestionsNavBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/admin/help-suggestions?count=1", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && typeof data.unread === "number") setCount(data.unread);
      } catch {
        /* ignore */
      }
    }

    void load();
    const onRefresh = () => void load();
    window.addEventListener("coach-suggestions-badge-refresh", onRefresh);
    const id = window.setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      window.removeEventListener("coach-suggestions-badge-refresh", onRefresh);
      window.clearInterval(id);
    };
  }, []);

  if (count <= 0) return null;

  return (
    <span
      className="inline-flex h-[18px] min-w-[18px] shrink-0 translate-y-[-1px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-black shadow-sm ring-2 ring-[var(--surface)]"
      aria-label={`${count} unread coach suggestions`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}