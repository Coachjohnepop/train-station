"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ChatNavBadge from "@/components/ChatNavBadge";
import CoachSuggestionsNavBadge from "@/components/CoachSuggestionsNavBadge";
import LeadsNavBadge from "@/components/LeadsNavBadge";
import QueueNavBadge from "@/components/QueueNavBadge";
import type { AdminNavGroup } from "@/lib/admin-nav-sections";

function navShortLabel(label: string): string {
  const words = label.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return label.slice(0, 2).toUpperCase();
}

export default function AdminSectionNav({
  groups,
  onNavClick,
  preferDashboardStorageKey,
  collapsed = false,
}: {
  groups: AdminNavGroup[];
  onNavClick?: () => void;
  preferDashboardStorageKey?: string;
  collapsed?: boolean;
}) {
  const pathname = usePathname();

  function handleNavClick(href: string) {
    if (preferDashboardStorageKey && (href === "/admin" || href === "/admin/day")) {
      sessionStorage.setItem(preferDashboardStorageKey, "1");
    }
    onNavClick?.();
  }

  return (
    <nav
      className={`admin-sidebar-nav space-y-5 ${collapsed ? "admin-sidebar-nav--collapsed" : ""}`}
      aria-label="Admin sections"
    >
      {groups.map((group) => (
        <div key={group.label}>
          {collapsed ? (
            <p className="sr-only">{group.label}</p>
          ) : (
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[2px] text-[var(--muted)]">
              {group.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = item.match(pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    onClick={() => handleNavClick(item.href)}
                    className={`flex min-h-[44px] items-center rounded-lg text-sm font-medium transition ${
                      collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
                    } ${
                      active
                        ? "nav-tab-active text-accent"
                        : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                    }`}
                  >
                    {/* Badge sits right after the last letter of the label (not far-right of the row) */}
                    <span className="inline-flex max-w-full items-center gap-1.5">
                      <span
                        className={
                          collapsed
                            ? "text-[11px] font-bold tracking-wide"
                            : "min-w-0 truncate"
                        }
                      >
                        {collapsed ? navShortLabel(item.label) : item.label}
                      </span>
                      {item.badge === "chat" ? <ChatNavBadge role="coach" /> : null}
                      {item.leadsBadge ? <LeadsNavBadge /> : null}
                      {item.queueBadge ? <QueueNavBadge /> : null}
                      {item.coachSuggestionsBadge ? <CoachSuggestionsNavBadge /> : null}
                    </span>
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