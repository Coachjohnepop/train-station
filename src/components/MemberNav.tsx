"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ChatNavBadge from "@/components/ChatNavBadge";

const items = [
  { href: "/member", label: "Home", match: (p: string) => p === "/member" },
  {
    href: "/member/programs",
    label: "Programs",
    match: (p: string) => p.startsWith("/member/programs"),
  },
  {
    href: "/member/today",
    label: "Today",
    match: (p: string) => p === "/member/today" || p === "/member/workout",
  },
  {
    href: "/member/chat",
    label: "Messages",
    match: (p: string) => p.startsWith("/member/chat"),
    badge: true,
  },
  {
    href: "/member/live",
    label: "Live",
    match: (p: string) => p === "/member/live",
  },
  {
    href: "/member/book",
    label: "Book Call",
    match: (p: string) => p.startsWith("/member/book"),
  },
];

export default function MemberNav() {
  const pathname = usePathname();

  return (
    <nav className="mx-auto flex w-full max-w-lg md:max-w-3xl lg:max-w-6xl xl:max-w-7xl gap-1 px-2 pb-2 md:px-6 lg:px-8 lg:justify-center">
      {items.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex-1 lg:flex-none lg:px-6 rounded-lg py-2 text-center text-xs font-medium transition ${
              active
                ? "nav-tab-active text-accent"
                : "text-[var(--muted)] hover:bg-[var(--surface-2)]"
            }`}
          >
            {item.label}
            {"badge" in item && item.badge ? <ChatNavBadge role="member" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}