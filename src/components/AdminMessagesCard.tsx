"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function AdminMessagesCard() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/chat/unread?role=coach", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setUnread(data.unread || 0);
      } catch {
        /* ignore */
      }
    }
    load();
    const id = setInterval(load, 15000);
    const refresh = () => load();
    window.addEventListener("coach-chat-posted", refresh);
    window.addEventListener("chat-unread-refresh", refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener("coach-chat-posted", refresh);
      window.removeEventListener("chat-unread-refresh", refresh);
    };
  }, []);

  return (
    <Link href="/admin/chat" className="card relative transition hover-accent-border ring-1 ring-accent/25 bg-accent/10">
      {unread > 0 && (
        <span className="absolute right-3 top-3 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#ff3b30] px-1.5 text-[11px] font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
      <p className="text-sm font-semibold text-accent">Messages</p>
      <p className="mt-2 text-3xl font-bold tabular-nums leading-none">{unread > 0 ? unread : "→"}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        {unread > 0
          ? `${unread} unread member ${unread === 1 ? "reply" : "replies"}`
          : "Patreon-style inbox · posts, clips, replies"}
      </p>
    </Link>
  );
}