"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminSectionNav from "@/components/AdminSectionNav";
import {
  COACH_NAV_GROUPS,
  PLATFORM_NAV_GROUPS,
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
    <div className="space-y-4">
      {dualWorkspace ? (
        <div className="space-y-2 px-2">
          <span className="text-[10px] font-semibold uppercase tracking-[2px] text-[var(--muted)]">
            Workspace
          </span>
          <div className="flex flex-col gap-1">
            <Link
              href={defaultCoachAdminPath()}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                section === "coach"
                  ? "nav-tab-active text-accent"
                  : "text-[var(--muted)] hover:bg-[var(--surface-2)]"
              }`}
            >
              Coach
            </Link>
            <Link
              href={defaultPlatformAdminPath()}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                section === "platform"
                  ? "nav-tab-active text-accent"
                  : "text-[var(--muted)] hover:bg-[var(--surface-2)]"
              }`}
            >
              Platform
            </Link>
          </div>
          <p className="text-[11px] leading-snug text-[var(--muted)]">
            {section === "coach"
              ? "Programs, members, live floor"
              : "Payments, users, site ops"}
          </p>
        </div>
      ) : workspaceLabel ? (
        <p className="px-2 text-[10px] font-semibold uppercase tracking-[2px] text-[var(--muted)]">
          {workspaceLabel}
        </p>
      ) : null}

      <AdminSectionNav
        groups={
          section === "platform" && canPlatform ? PLATFORM_NAV_GROUPS : COACH_NAV_GROUPS
        }
      />
    </div>
  );
}