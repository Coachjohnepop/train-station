"use client";

import { useEffect, useState } from "react";

export default function ChatNavBadge({ role }: { role: "coach" | "member" }) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/chat/unread?role=${role}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setUnread(data.unread || 0);
      } catch {
        /* ignore */
      }
    }
    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [role]);

  if (unread <= 0) return null;

  return (
    <span className="ml-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold leading-none text-black">
      {unread > 9 ? "9+" : unread}
    </span>
  );
}