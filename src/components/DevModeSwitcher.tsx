"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const DEMO_MEMBERS = [
  { id: "demo-user-john", label: "John" },
  { id: "demo-user-stephanie", label: "Stephanie" },
  { id: "demo-user", label: "Alex" },
];

export default function DevModeSwitcher({
  active,
}: {
  active: "member" | "admin";
}) {
  const pathname = usePathname();

  return (
    <div className="app-shell-subbar">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 px-4 py-2">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          Preview
        </span>
        <Link
          href="/member"
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            active === "member"
              ? "nav-tab-active text-accent"
              : "text-[var(--muted)] hover:text-[var(--text)]"
          }`}
        >
          Member
        </Link>
        <Link
          href="/admin"
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            active === "admin"
              ? "nav-tab-active text-accent"
              : "text-[var(--muted)] hover:text-[var(--text)]"
          }`}
        >
          Coach admin
        </Link>
        {active === "member" && (
          <>
            <span className="mx-1 text-[10px] text-[var(--muted)]">|</span>
            <span className="text-[10px] text-[var(--muted)]">View as:</span>
            {DEMO_MEMBERS.map((m) => (
              <a
                key={m.id}
                href={`/api/dev/switch-user?id=${m.id}&redirect=${encodeURIComponent(pathname || "/member")}`}
                className="rounded-full px-2 py-0.5 text-[10px] font-medium text-accent hover:bg-accent/10"
              >
                {m.label}
              </a>
            ))}
          </>
        )}
      </div>
    </div>
  );
}