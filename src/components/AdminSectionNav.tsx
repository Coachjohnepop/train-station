"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ChatNavBadge from "@/components/ChatNavBadge";
import LeadsNavBadge from "@/components/LeadsNavBadge";
import type { AdminNavItem } from "@/lib/admin-nav-sections";

export default function AdminSectionNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1">
      {items.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "nav-tab-active text-accent"
                : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            }`}
          >
            {item.label}
            {item.badge === "chat" ? <ChatNavBadge role="coach" /> : null}
            {item.leadsBadge ? <LeadsNavBadge /> : null}
          </Link>
        );
      })}
    </nav>
  );
}