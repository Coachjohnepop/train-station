"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/member", label: "Home", match: (p: string) => p === "/member" },
  {
    href: "/member/programs",
    label: "Programs",
    match: (p: string) => p.startsWith("/member/programs"),
  },
  {
    href: "/member/workout",
    label: "Workout",
    match: (p: string) => p === "/member/workout",
  },
  {
    href: "/member/live",
    label: "Live",
    match: (p: string) => p === "/member/live",
  },
];

export default function MemberNav() {
  const pathname = usePathname();

  return (
    <nav className="mx-auto flex max-w-lg gap-1 px-2 pb-2">
      {items.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 rounded-lg py-2 text-center text-xs font-medium transition ${
              active
                ? "nav-tab-active text-accent"
                : "text-[var(--muted)] hover:bg-[var(--surface-2)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}