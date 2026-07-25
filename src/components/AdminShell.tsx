"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import AdminAreaNav from "@/components/AdminAreaNav";
import AdminAppSearch from "@/components/AdminAppSearch";
import AdminPersistenceBanner from "@/components/AdminPersistenceBanner";
import ResumePathTracker from "@/components/ResumePathTracker";

import AdminMobileCoachNav from "@/components/AdminMobileCoachNav";
import CoachHelpAssistant from "@/components/CoachHelpAssistant";
import TrainStationBrand from "@/components/TrainStationBrand";
import DevModeSwitcher from "@/components/DevModeSwitcher";
import LogoutButton from "@/components/LogoutButton";
import ChatNavBadge from "@/components/ChatNavBadge";
import CoachJoinLiveNavStrip from "@/components/CoachJoinLiveNavStrip";
import UnreadAppBadge from "@/components/UnreadAppBadge";
import PwaInstallHint from "@/components/PwaInstallHint";
import PushAlertEnable from "@/components/PushAlertEnable";
import UserBicepAvatar from "@/components/UserBicepAvatar";
import type { SessionUser } from "@/lib/auth-session";
import {
  readAdminNavCollapsed,
  writeAdminNavCollapsed,
} from "@/lib/admin-nav-collapsed";
import {
  ADMIN_NAV_WIDTH_COLLAPSED,
  ADMIN_NAV_WIDTH_DEFAULT,
  clampAdminNavWidth,
  readAdminNavWidth,
  writeAdminNavWidth,
} from "@/lib/admin-nav-width";

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
  const pathname = usePathname();
  const coachFloorFocus = pathname.startsWith("/admin/today");
  /** Slim chrome on phone/tablet Messages so jelly beans stay sticky and tappable. Desktop keeps full nav. */
  const [coachMessagesFocus, setCoachMessagesFocus] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1279px)");
    const sync = () =>
      setCoachMessagesFocus(mq.matches && pathname.startsWith("/admin/chat"));
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [pathname]);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [navWidth, setNavWidth] = useState(ADMIN_NAV_WIDTH_DEFAULT);
  const [navResizing, setNavResizing] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(ADMIN_NAV_WIDTH_DEFAULT);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);

  useEffect(() => {
    setNavCollapsed(readAdminNavCollapsed());
    setNavWidth(readAdminNavWidth());
  }, []);

  const toggleNavCollapsed = useCallback(() => {
    setNavCollapsed((current) => {
      const next = !current;
      writeAdminNavCollapsed(next);
      return next;
    });
  }, []);

  const onNavResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (navCollapsed) return;
      e.preventDefault();
      resizeStartX.current = e.clientX;
      resizeStartW.current = navWidth;
      setNavResizing(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [navCollapsed, navWidth],
  );

  const onNavResizePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!navResizing) return;
      const delta = e.clientX - resizeStartX.current;
      setNavWidth(clampAdminNavWidth(resizeStartW.current + delta));
    },
    [navResizing],
  );

  const endNavResize = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!navResizing) return;
      setNavResizing(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      const delta = e.clientX - resizeStartX.current;
      const next = clampAdminNavWidth(resizeStartW.current + delta);
      setNavWidth(next);
      writeAdminNavWidth(next);
    },
    [navResizing],
  );

  const resetNavWidth = useCallback(() => {
    setNavWidth(ADMIN_NAV_WIDTH_DEFAULT);
    writeAdminNavWidth(ADMIN_NAV_WIDTH_DEFAULT);
    if (navCollapsed) {
      setNavCollapsed(false);
      writeAdminNavCollapsed(false);
    }
  }, [navCollapsed]);

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

  if (coachFloorFocus) {
    return (
      <div className="coach-floor-shell flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[var(--bg)]">
        {/* Frozen top bar: Messages stay reachable while the live floor / sets scroll */}
        <header className="coach-floor-sticky-chrome sticky top-0 z-40 shrink-0 border-b border-sky-500/30 bg-[var(--bg)]/95 backdrop-blur-sm">
          <div className="flex min-h-[52px] items-center justify-between gap-2 px-2 py-2 sm:px-3">
            <Link
              href="/admin/day"
              className="btn-ghost min-h-[40px] shrink-0 px-2 text-xs font-semibold sm:min-h-[44px] sm:px-3 sm:text-sm"
            >
              ← Dashboard
            </Link>
            <p className="min-w-0 truncate text-center text-xs font-bold tracking-tight sm:text-sm">
              Go to Today
            </p>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <AdminAppSearch
                canCoach={canCoach}
                canPlatform={canPlatform}
                collapsed
                enableHotkey
              />
              <Link
                href="/admin/chat"
                className="relative inline-flex min-h-[40px] items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-semibold text-[var(--text)] transition hover:border-accent hover:text-accent sm:min-h-[44px] sm:px-3 sm:text-sm"
                title="Messages — chat with members while coaching"
                aria-label="Messages"
              >
                <span className="sm:hidden">Msgs</span>
                <span className="hidden sm:inline">Messages</span>
                <ChatNavBadge role="coach" placement="corner" />
              </Link>
              <CoachJoinLiveNavStrip />
              <LogoutButton compact className="shrink-0" />
            </div>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto px-2 py-2 sm:px-3">
          {children}
        </main>
        <UnreadAppBadge role="coach" />
        <CoachHelpAssistant />
      </div>
    );
  }

  // Messages: slim top chrome so member jelly-bean chips freeze and stay tappable.
  if (coachMessagesFocus) {
    return (
      <div className="coach-messages-shell flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[var(--bg)]">
        <header className="coach-messages-sticky-chrome sticky top-0 z-50 shrink-0 border-b border-violet-500/30 bg-[var(--bg)]/95 backdrop-blur-sm">
          <div className="flex min-h-[44px] items-center justify-between gap-2 px-2 py-1.5 sm:px-3">
            <Link
              href="/admin/day"
              className="btn-ghost min-h-[40px] shrink-0 px-2 text-xs font-semibold"
            >
              ← Board
            </Link>
            <p className="inline-flex min-w-0 items-center justify-center gap-1.5 truncate text-center text-xs font-bold tracking-tight">
              Messages
              <ChatNavBadge role="coach" placement="inline" />
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              <Link
                href="/admin/today"
                className="btn-ghost min-h-[40px] px-2 text-xs font-semibold"
              >
                Today
              </Link>
              <LogoutButton compact className="shrink-0" />
            </div>
          </div>
        </header>
        <main className="coach-messages-main min-h-0 flex-1 overflow-y-auto px-2 py-2 pb-[max(5.5rem,env(safe-area-inset-bottom))] sm:px-3 xl:pb-4">
          <div className="mb-2 space-y-2">
            <PwaInstallHint compact />
            <PushAlertEnable compact />
          </div>
          {children}
        </main>
        <AdminMobileCoachNav onOpenMenu={openDrawer} />
        <UnreadAppBadge role="coach" />
        {/* Drawer still available via More on bottom nav */}
        {drawerOpen ? (
          <div className="fixed inset-0 z-[60] xl:hidden" role="dialog" aria-modal="true">
            <button
              type="button"
              className="absolute inset-0 bg-black/60"
              aria-label="Close menu"
              onClick={closeDrawer}
            />
            <aside className="absolute bottom-0 left-0 right-0 flex max-h-[85vh] flex-col rounded-t-2xl border-t border-[var(--border)] bg-[var(--bg)] shadow-xl">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
                <p className="text-sm font-medium">Menu</p>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--muted)]"
                  aria-label="Close menu"
                >
                  ✕
                </button>
              </div>
              <div className="overflow-y-auto px-3 py-4">
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
        <CoachHelpAssistant />
      </div>
    );
  }

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

      {/* Mobile / tablet sticky top: menu + search always visible */}
      <header className="app-shell-header header-theme-clearance sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/95 px-3 py-2 backdrop-blur-md xl:hidden">
        <div className="flex items-center gap-2">
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
          <div className="min-w-0 flex-1">
            <AdminAppSearch
              canCoach={canCoach}
              canPlatform={canPlatform}
              variant="topbar"
              enableHotkey
            />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <LogoutButton compact />
          </div>
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
              <div className="flex min-w-0 items-center gap-2.5">
                <UserBicepAvatar size={36} title={session?.name || "Coach"} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{session?.name || "Coach"}</p>
                  <p className="truncate text-[10px] text-[var(--muted)]">
                    {areaLabel}
                    {session?.email ? ` · ${session.email}` : ""}
                  </p>
                </div>
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

      {/* Desktop sidebar — wide screens only; drag right edge to resize */}
      <aside
        className={`app-shell-header admin-sidebar relative hidden xl:sticky xl:top-0 xl:flex xl:h-screen xl:shrink-0 xl:flex-col xl:border-r xl:border-[var(--border)] ${
          navResizing ? "" : "xl:transition-[width] xl:duration-200"
        }`}
        style={{
          width: navCollapsed ? ADMIN_NAV_WIDTH_COLLAPSED : navWidth,
        }}
      >
        <div className="flex h-full min-h-0 flex-col gap-4 px-2 py-5">
          {showDevSwitcher ? (
            <div
              className={`space-y-2 border-b border-[var(--border)] pb-4 ${navCollapsed ? "px-0" : "px-1"}`}
            >
              {!navCollapsed ? (
                <DevModeSwitcher active="admin" staffSession={session} showImpersonation />
              ) : (
                <p className="sr-only">Dev mode switcher</p>
              )}
            </div>
          ) : null}
          <div
            className={`flex flex-col gap-2 ${navCollapsed ? "items-center px-0" : "items-stretch px-1"}`}
          >
            <Link
              href="/admin/day"
              className="transition hover:opacity-90"
              title={navCollapsed ? "The Train Station" : undefined}
            >
              <TrainStationBrand
                variant="header"
                className={navCollapsed ? "!h-7 !w-7" : "!h-8"}
              />
            </Link>
            {navCollapsed ? (
              <LogoutButton
                compact
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] hover:text-accent"
              />
            ) : (
              <LogoutButton />
            )}
          </div>
          {!navCollapsed ? (
            <div className="flex min-w-0 items-center gap-2.5 px-1">
              <UserBicepAvatar size={36} title={session?.name || "Coach"} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{session?.name || "Coach"}</p>
                <p className="truncate text-[10px] text-[var(--muted)]">
                  {areaLabel}
                  {session?.email ? ` · ${session.email}` : ""}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center px-0" title={session?.name || "Coach"}>
              <UserBicepAvatar size={32} title={session?.name || "Coach"} />
              <span className="sr-only">
                {session?.name || "Coach"} · {areaLabel}
              </span>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <AdminAreaNav
              dualWorkspace={dualWorkspace}
              canCoach={canCoach}
              canPlatform={canPlatform}
              preferDashboardStorageKey="ts-admin-prefer-dashboard"
              collapsed={navCollapsed}
            />
          </div>
          <button
            type="button"
            onClick={toggleNavCollapsed}
            className={`flex min-h-[44px] items-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--text)] ${
              navCollapsed ? "w-full justify-center px-0" : "w-full justify-center gap-2 px-3"
            }`}
            aria-label={navCollapsed ? "Expand navigation" : "Collapse navigation"}
            title={navCollapsed ? "Expand navigation" : "Collapse navigation"}
          >
            <span aria-hidden>{navCollapsed ? "»" : "«"}</span>
            {!navCollapsed ? <span>Collapse</span> : null}
          </button>
        </div>

        {/* Resize handle — desktop only; double-click resets width */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize navigation"
          aria-valuenow={navCollapsed ? ADMIN_NAV_WIDTH_COLLAPSED : navWidth}
          aria-valuemin={ADMIN_NAV_WIDTH_COLLAPSED}
          title={
            navCollapsed
              ? "Expand navigation to resize"
              : "Drag to resize · double-click to reset"
          }
          className={`absolute inset-y-0 right-0 z-20 hidden w-1.5 cursor-col-resize touch-none xl:block ${
            navCollapsed
              ? "pointer-events-none opacity-0"
              : "hover:bg-accent/40 active:bg-accent/50"
          } ${navResizing ? "bg-accent/50" : ""}`}
          onPointerDown={onNavResizePointerDown}
          onPointerMove={onNavResizePointerMove}
          onPointerUp={endNavResize}
          onPointerCancel={endNavResize}
          onDoubleClick={(e) => {
            e.preventDefault();
            resetNavWidth();
          }}
        />
      </aside>

      {/* Prevent text selection while dragging the nav */}
      {navResizing ? (
        <div className="fixed inset-0 z-[60] cursor-col-resize" aria-hidden />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Desktop sticky search — stays at top of the browser viewport while content scrolls */}
        <div className="app-shell-header sticky top-0 z-40 hidden border-b border-[var(--border)] bg-[var(--bg)]/95 px-4 py-2.5 backdrop-blur-md xl:block">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-3 md:max-w-7xl xl:max-w-[min(100%,96rem)]">
            <div className="min-w-0 flex-1">
              <AdminAppSearch
                canCoach={canCoach}
                canPlatform={canPlatform}
                variant="topbar"
                enableHotkey
              />
            </div>
            <Link
              href="/admin/discounts"
              className="btn-ghost shrink-0 px-3 py-2 text-xs font-semibold"
              title="Discount codes"
            >
              Discount codes
            </Link>
          </div>
        </div>
        <main className="admin-main mx-auto w-full max-w-6xl flex-1 px-3 py-4 pb-[max(6rem,env(safe-area-inset-bottom))] md:max-w-7xl md:px-6 md:py-6 xl:max-w-[min(100%,96rem)] xl:px-8 xl:pb-8">
          <AdminPersistenceBanner />
          <div className="mb-3 space-y-2">
            <PwaInstallHint compact />
            <PushAlertEnable compact />
          </div>
          {children}
        </main>
      </div>

      <AdminMobileCoachNav onOpenMenu={openDrawer} />
      <UnreadAppBadge role="coach" />
      <CoachHelpAssistant />
    </div>
  );
}