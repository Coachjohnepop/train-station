"use client";

import Link from "next/link";
import type { SessionUser } from "@/lib/auth-session";
import { isStaffRole } from "@/lib/auth-session";
import { DEFAULT_DEMO_MEMBER_ID } from "@/lib/demo-coach";

const DEMO_MEMBERS = [
  { id: DEFAULT_DEMO_MEMBER_ID, label: "John & Steph" },
  { id: "demo-user-john", label: "Chad" },
  { id: "demo-user-stephanie", label: "Kaite" },
  { id: "demo-user", label: "Alex" },
  { id: "demo-user-2", label: "Jordan" },
];

export default function DevModeSwitcher({
  active,
  staffSession,
  showImpersonation = true,
}: {
  active: "member" | "admin";
  staffSession?: SessionUser | null;
  /** Off in production — hides demo member preview links for real coaches. */
  showImpersonation?: boolean;
}) {
  const canImpersonate =
    showImpersonation && staffSession && isStaffRole(staffSession.role);

  return (
    <div className="app-shell-subbar">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 px-4 py-1.5 sm:py-2">
        <span className="mr-1 hidden text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] sm:inline">
          View
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
          Admin
        </Link>
        {canImpersonate ? (
          <>
            <span className="mx-1 hidden text-[10px] text-[var(--muted)] sm:inline">|</span>
            <span className="hidden text-[10px] text-[var(--muted)] md:inline">
              {active === "member" ? "Viewing as — switch to:" : "Preview as member:"}
            </span>
            {DEMO_MEMBERS.map((m) => (
              <a
                key={m.id}
                href={`/api/dev/switch-user?id=${m.id}&redirect=${encodeURIComponent(active === "member" ? "/member/today" : "/member")}`}
                className="hidden rounded-full px-2 py-0.5 text-[10px] font-medium text-accent hover:bg-accent/10 md:inline"
              >
                {m.label}
              </a>
            ))}
          </>
        ) : null}
      </div>
    </div>
  );
}