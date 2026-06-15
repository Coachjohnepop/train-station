"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ChatNavBadge from "@/components/ChatNavBadge";

const items = [
  { href: "/admin", label: "Overview", match: (p: string) => p === "/admin" },
  {
    href: "/admin/leads",
    label: "Leads",
    match: (p: string) => p.startsWith("/admin/leads"),
  },
  {
    href: "/admin/exercises",
    label: "Exercises",
    match: (p: string) => p.startsWith("/admin/exercises"),
  },
  {
    href: "/admin/workouts",
    label: "Workouts",
    match: (p: string) => p.startsWith("/admin/workouts"),
  },
  {
    href: "/admin/programs",
    label: "Programs",
    match: (p: string) => p.startsWith("/admin/programs"),
  },
  {
    href: "/admin/users",
    label: "Users",
    match: (p: string) => p.startsWith("/admin/users"),
  },
  {
    href: "/admin/today",
    label: "Today",
    match: (p: string) => p.startsWith("/admin/today"),
  },
  {
    href: "/admin/chat",
    label: "Messages",
    match: (p: string) => p.startsWith("/admin/chat"),
    badge: true,
  },
  {
    href: "/admin/bookings",
    label: "Bookings",
    match: (p: string) => p.startsWith("/admin/bookings"),
  },
  {
    href: "/admin/reports",
    label: "Reports",
    match: (p: string) => p.startsWith("/admin/reports"),
  },
];

export default function AdminNav() {
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
            {"badge" in item && item.badge ? <ChatNavBadge role="coach" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}