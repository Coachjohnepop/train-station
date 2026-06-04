"use client";

import Link from "next/link";

export default function DevModeSwitcher({
  active,
}: {
  active: "member" | "admin";
}) {
  return (
    <div className="app-shell-subbar">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2">
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
      </div>
    </div>
  );
}