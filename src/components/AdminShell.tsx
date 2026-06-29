"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AdminAreaNav from "@/components/AdminAreaNav";
import TrainStationBrand from "@/components/TrainStationBrand";
import DevModeSwitcher from "@/components/DevModeSwitcher";
import LogoutButton from "@/components/LogoutButton";
import type { SessionUser } from "@/lib/auth-session";

type Props = {
  children: React.ReactNode;
  session: SessionUser | null;
  areaLabel: string;
  dualWorkspace: boolean;
  canCoach: boolean;
  canPlatform: boolean;
  showDevSwitcher: boolean;
};

export default function AdminShell({
  children,
  session,
  areaLabel,
  dualWorkspace,
  canCoach,
  canPlatform,
  showDevSwitcher,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeDrawer();
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen, closeDrawer]);

  return (
    <div className="app-shell-bg flex min-h-screen flex-col lg:flex-row">
      <DevModeSwitcher
        active="admin"
        staffSession={session}
        showImpersonation={showDevSwitcher}
      />

      {/* Mobile header */}
      <header className="app-shell-header flex items-center justify-between gap-3 px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]"
          aria-label="Open menu"
          aria-expanded={drawerOpen}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <Link href="/admin/queue" className="min-w-0 flex-1 transition hover:opacity-90">
          <TrainStationBrand variant="header" className="!h-7" />
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/admin/live"
            className="rounded-lg px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wide text-accent ring-1 ring-accent/30"
          >
            Live
          </Link>
          <LogoutButton />
        </div>
      </header>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close menu"
            onClick={closeDrawer}
          />
          <aside className="absolute left-0 top-0 flex h-full w-[min(100%,18rem)] flex-col border-r border-[var(--border)] bg-[var(--bg)] shadow-xl">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{session?.name || "Coach"}</p>
                <p className="truncate text-[10px] text-[var(--muted)]">
                  {areaLabel}
                  {session?.email ? ` · ${session.email}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-2)]"
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4" onClick={closeDrawer}>
              <AdminAreaNav
                dualWorkspace={dualWorkspace}
                canCoach={canCoach}
                canPlatform={canPlatform}
                onNavClick={closeDrawer}
                preferDashboardStorageKey="ts-admin-prefer-dashboard"
              />
            </div>
          </aside>
        </div>
      ) : null}

      {/* Desktop sidebar */}
      <aside className="app-shell-header hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-56 lg:shrink-0 lg:flex-col lg:border-r lg:border-[var(--border)]">
        <div className="flex flex-col gap-4 px-3 py-5">
          <div className="flex flex-col items-stretch gap-2">
            <Link href="/admin" className="transition hover:opacity-90">
              <TrainStationBrand variant="header" className="!h-8" />
            </Link>
            <LogoutButton />
          </div>
          <div>
            <p className="text-sm font-medium">{session?.name || "Coach"}</p>
            <p className="text-[10px] text-[var(--muted)]">
              {areaLabel}
              {session?.email ? ` · ${session.email}` : ""}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            <AdminAreaNav
              dualWorkspace={dualWorkspace}
              canCoach={canCoach}
              canPlatform={canPlatform}
              preferDashboardStorageKey="ts-admin-prefer-dashboard"
            />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 md:px-6 md:py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}