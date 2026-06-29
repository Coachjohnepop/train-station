"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminSectionNav from "@/components/AdminSectionNav";
import {
  COACH_NAV_ITEMS,
  PLATFORM_NAV_ITEMS,
  defaultCoachAdminPath,
  defaultPlatformAdminPath,
  isPlatformAdminPath,
} from "@/lib/admin-nav-sections";

type Props = {
  dualWorkspace: boolean;
  canCoach: boolean;
  canPlatform: boolean;
};

export default function AdminAreaNav({ dualWorkspace, canCoach, canPlatform }: Props) {
  const pathname = usePathname();
  const onPlatform = canPlatform && isPlatformAdminPath(pathname);
  const section: "coach" | "platform" = onPlatform ? "platform" : "coach";

  const workspaceLabel = dualWorkspace
    ? null
    : canPlatform
      ? "Platform workspace"
      : "Coach workspace";

  return (
    <div className="space-y-3">
      {dualWorkspace ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[2px] text-[var(--muted)]">
            Workspace
          </span>
          <div className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-2)] p-0.5">
            <Link
              href={defaultCoachAdminPath()}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                section === "coach"
                  ? "nav-tab-active text-accent"
                  : "text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              Coach
            </Link>
            <Link
              href={defaultPlatformAdminPath()}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                section === "platform"
                  ? "nav-tab-active text-accent"
                  : "text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              Platform
            </Link>
          </div>
          <span className="text-[11px] text-[var(--muted)]">
            {section === "coach"
              ? "Programs, members, and day-to-day coaching"
              : "Payments, users, and site operations"}
          </span>
        </div>
      ) : workspaceLabel ? (
        <p className="text-[10px] font-semibold uppercase tracking-[2px] text-[var(--muted)]">
          {workspaceLabel}
        </p>
      ) : null}

      <AdminSectionNav
        items={
          section === "platform" && canPlatform ? PLATFORM_NAV_ITEMS : COACH_NAV_ITEMS
        }
      />
    </div>
  );
}