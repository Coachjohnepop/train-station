"use client";

import { useEffect, useState } from "react";
import { LEADS_SEEN_KEY } from "@/components/LeadsNavBadge";
import { MEMBERS_SEEN_KEY } from "@/components/MembersNavBadge";

/**
 * Combined purple badge for coach mobile "People" tab:
 * new account signups + unseen landing leads.
 * Red stays exclusive to Messages (member replies).
 */
export default function PeopleAttentionBadge({
  placement = "corner",
}: {
  placement?: "inline" | "corner";
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const membersSince = localStorage.getItem(MEMBERS_SEEN_KEY) || "";
        const leadsSince = localStorage.getItem(LEADS_SEEN_KEY) || "";
        const [membersRes, leadsRes] = await Promise.all([
          fetch(
            `/api/admin/members/new-count?since=${encodeURIComponent(membersSince)}`,
            { cache: "no-store" },
          ),
          fetch(`/api/leads/count?since=${encodeURIComponent(leadsSince)}`, {
            cache: "no-store",
          }),
        ]);
        const membersData = membersRes.ok ? await membersRes.json() : { new: 0 };
        const leadsData = leadsRes.ok ? await leadsRes.json() : { new: 0 };
        if (!cancelled) {
          setCount((membersData.new || 0) + (leadsData.new || 0));
        }
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
    window.addEventListener("leads-badge-refresh", onRefresh);

    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("members-badge-refresh", onRefresh);
      window.removeEventListener("leads-badge-refresh", onRefresh);
    };
  }, []);

  if (count <= 0) return null;

  return (
    <span
      className={
        placement === "corner"
          ? "absolute -right-1.5 -top-1.5 z-10 flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-bold leading-none text-white shadow-md ring-2 ring-[var(--bg)]"
          : "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-[var(--surface)]"
      }
      aria-label={`${count} new people needing attention`}
      title={`${count} new signup/lead — open People / Members`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
