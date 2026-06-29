"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ChatNavBadge from "@/components/ChatNavBadge";
import LeadsNavBadge from "@/components/LeadsNavBadge";
import type { AdminNavGroup } from "@/lib/admin-nav-sections";

export default function AdminSectionNav({ groups }: { groups: AdminNavGroup[] }) {
  const pathname = usePathname();

  return (
    <nav className="admin-sidebar-nav space-y-5" aria-label="Admin sections">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[2px] text-[var(--muted)]">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = item.match(pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`relative flex min-h-[44px] items-center rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? "nav-tab-active text-accent"
                        : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                    }`}
                  >
                    {item.label}
                    {item.badge === "chat" ? <ChatNavBadge role="coach" /> : null}
                    {item.leadsBadge ? <LeadsNavBadge /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}