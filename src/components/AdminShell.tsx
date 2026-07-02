"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import AdminAreaNav from "@/components/AdminAreaNav";
import ResumePathTracker from "@/components/ResumePathTracker";

import AdminMobileCoachNav from "@/components/AdminMobileCoachNav";
import CoachHelpAssistant from "@/components/CoachHelpAssistant";
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
  const openDrawer = useCallback(() => setDrawerOpen(true), []);

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
    <div className="app-shell-bg flex min-h-screen flex-col xl:flex-row">
      <Suspense fallback={null}>
        <ResumePathTracker area="coach" />
      </Suspense>
      {showDevSwitcher ? (
        <div className="hidden xl:block">
          <DevModeSwitcher active="admin" staffSession={session} showImpersonation />
        </div>
      ) : (
        <div className="xl:hidden border-b border-[var(--border)] px-4 py-2">
          <Link
            href="/member"
            className="text-xs font-semibold text-[var(--muted)] hover:text-accent"
          >
            ← Member app
          </Link>
        </div>
      )}

      {/* Mobile / tablet header */}
      <header className="app-shell-header sticky top-0 z-30 flex items-center justify-between gap-2 px-3 py-2.5 xl:hidden">
        <button
          type="button"
          onClick={openDrawer}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)]"
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
        <Link href="/admin/queue" className="min-w-0 flex-1 text-center transition hover:opacity-90">
          <TrainStationBrand variant="header" className="!h-6 mx-auto" />
        </Link>
        <div className="flex w-11 shrink-0 items-center justify-end">
          <LogoutButton />
        </div>
      </header>

      {/* Drawer — mobile / tablet only */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close menu"
            onClick={closeDrawer}
          />
          <aside className="absolute bottom-0 left-0 right-0 flex max-h-[85vh] flex-col rounded-t-2xl border-t border-[var(--border)] bg-[var(--bg)] shadow-xl">
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
            <div
              className="overflow-y-auto px-3 py-4"
              style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
            >
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

      {/* Desktop sidebar — wide screens only */}
      <aside className="app-shell-header hidden xl:sticky xl:top-0 xl:flex xl:h-screen xl:w-56 xl:shrink-0 xl:flex-col xl:border-r xl:border-[var(--border)]">
        <div className="flex flex-col gap-4 px-3 py-5">
          {showDevSwitcher ? (
            <div className="space-y-2 border-b border-[var(--border)] pb-4">
              <DevModeSwitcher active="admin" staffSession={session} showImpersonation />
            </div>
          ) : null}
          <div className="flex flex-col items-stretch gap-2">
            <Link href="/admin/day" className="transition hover:opacity-90">
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
        <main className="admin-main mx-auto w-full max-w-6xl flex-1 px-3 py-4 pb-[max(6rem,env(safe-area-inset-bottom))] md:px-6 md:py-6 xl:max-w-[min(100%,96rem)] xl:px-8 xl:pb-8">
          {children}
        </main>
      </div>

      <AdminMobileCoachNav onOpenMenu={openDrawer} />
      <CoachHelpAssistant />
    </div>
  );
}