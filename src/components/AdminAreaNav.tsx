"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminAppSearch from "@/components/AdminAppSearch";
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
  onNavClick?: () => void;
  preferDashboardStorageKey?: string;
  collapsed?: boolean;
};

export default function AdminAreaNav({
  dualWorkspace,
  canCoach,
  canPlatform,
  onNavClick,
  preferDashboardStorageKey,
  collapsed = false,
}: Props) {
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
      <div className={collapsed ? "flex justify-center" : ""}>
        <AdminAppSearch
          canCoach={canCoach}
          canPlatform={canPlatform}
          onNavigate={onNavClick}
          collapsed={collapsed}
        />
      </div>
      {dualWorkspace ? (
        <div className={`space-y-2 ${collapsed ? "px-1" : "px-2"}`}>
          {collapsed ? (
            <span className="sr-only">Workspace</span>
          ) : (
            <span className="text-[10px] font-semibold uppercase tracking-[2px] text-[var(--muted)]">
              Workspace
            </span>
          )}
          <div className={`flex gap-1 ${collapsed ? "flex-col items-center" : "flex-col"}`}>
            <Link
              href={defaultCoachAdminPath()}
              title={collapsed ? "Coach workspace" : undefined}
              className={`rounded-lg text-sm font-semibold transition ${
                collapsed ? "flex h-10 w-10 items-center justify-center px-0 py-0 text-xs" : "px-3 py-2"
              } ${
                section === "coach"
                  ? "nav-tab-active text-accent"
                  : "text-[var(--muted)] hover:bg-[var(--surface-2)]"
              }`}
            >
              {collapsed ? "Co" : "Coach"}
            </Link>
            <Link
              href={defaultPlatformAdminPath()}
              title={collapsed ? "Platform workspace" : undefined}
              className={`rounded-lg text-sm font-semibold transition ${
                collapsed ? "flex h-10 w-10 items-center justify-center px-0 py-0 text-xs" : "px-3 py-2"
              } ${
                section === "platform"
                  ? "nav-tab-active text-accent"
                  : "text-[var(--muted)] hover:bg-[var(--surface-2)]"
              }`}
            >
              {collapsed ? "Pl" : "Platform"}
            </Link>
          </div>
          {!collapsed ? (
            <p className="text-[11px] leading-snug text-[var(--muted)]">
              {section === "coach"
                ? "Programs, members, live floor"
                : "Payments, users, site ops"}
            </p>
          ) : null}
        </div>
      ) : workspaceLabel ? (
        collapsed ? (
          <p className="sr-only">{workspaceLabel}</p>
        ) : (
          <p className="px-2 text-[10px] font-semibold uppercase tracking-[2px] text-[var(--muted)]">
            {workspaceLabel}
          </p>
        )
      ) : null}

      <AdminSectionNav
        groups={
          section === "platform" && canPlatform ? PLATFORM_NAV_GROUPS : COACH_NAV_GROUPS
        }
        onNavClick={onNavClick}
        preferDashboardStorageKey={preferDashboardStorageKey}
        collapsed={collapsed}
      />
    </div>
  );
}