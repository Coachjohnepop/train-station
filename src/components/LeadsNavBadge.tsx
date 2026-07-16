"use client";

import { useEffect, useState } from "react";

export const LEADS_SEEN_KEY = "ts-leads-last-seen";

export default function LeadsNavBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const since = localStorage.getItem(LEADS_SEEN_KEY) || "";
        const res = await fetch(
          `/api/leads/count?since=${encodeURIComponent(since)}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setCount(data.new || 0);
      } catch {
        /* ignore */
      }
    }

    load();
    const id = setInterval(load, 15000);

    function onRefresh() {
      load();
    }
    window.addEventListener("leads-badge-refresh", onRefresh);

    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("leads-badge-refresh", onRefresh);
    };
  }, []);

  if (count <= 0) return null;

  return (
    <span
      className="inline-flex h-[18px] min-w-[18px] shrink-0 translate-y-[-1px] items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-[var(--surface)]"
      aria-label={`${count} new leads`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
