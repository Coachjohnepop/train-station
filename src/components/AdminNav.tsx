"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Overview", match: (p: string) => p === "/admin" },
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
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "nav-tab-active text-accent"
                : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}