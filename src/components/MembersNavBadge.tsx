"use client";

import { useEffect, useState } from "react";

export const MEMBERS_SEEN_KEY = "ts-members-last-seen";

/**
 * Purple badge: new account signups since coach last opened Members.
 * Red is reserved for Messages unread.
 */
export default function MembersNavBadge({
  placement = "inline",
}: {
  placement?: "inline" | "corner";
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const since = localStorage.getItem(MEMBERS_SEEN_KEY) || "";
        const res = await fetch(
          `/api/admin/members/new-count?since=${encodeURIComponent(since)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setCount(data.new || 0);
      } catch {
        /* ignore */
      }
    }

    void load();
    const id = setInterval(load, 12000);

    function onRefresh() {
      void load();
    }
    window.addEventListener("members-badge-refresh", onRefresh);

    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("members-badge-refresh", onRefresh);
    };
  }, []);

  if (count <= 0) return null;

  return (
    <span
      className={
        placement === "corner"
          ? "absolute -right-1.5 -top-1.5 z-10 flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-bold leading-none text-white shadow-md ring-2 ring-[var(--bg)]"
          : "inline-flex h-[18px] min-w-[18px] shrink-0 translate-y-[-1px] items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-[var(--surface)]"
      }
      aria-label={`${count} new signups`}
      title={`${count} new signup${count === 1 ? "" : "s"} — open Members`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
