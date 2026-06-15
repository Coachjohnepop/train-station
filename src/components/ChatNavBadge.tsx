"use client";

import { useEffect, useState } from "react";

export default function ChatNavBadge({ role }: { role: "coach" | "member" }) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/chat/unread?role=${role}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setUnread(data.unread || 0);
      } catch {
        /* ignore */
      }
    }

    load();
    const id = setInterval(load, 12000);

    function onRefresh() {
      load();
    }
    window.addEventListener("chat-unread-refresh", onRefresh);
    window.addEventListener("coach-chat-posted", onRefresh);

    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("chat-unread-refresh", onRefresh);
      window.removeEventListener("coach-chat-posted", onRefresh);
    };
  }, [role]);

  if (unread <= 0) return null;

  return (
    <span
      className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-[var(--surface)]"
      aria-label={`${unread} unread messages`}
    >
      {unread > 99 ? "99+" : unread > 9 ? "9+" : unread}
    </span>
  );
}