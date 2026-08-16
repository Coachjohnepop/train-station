"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import TrainStationBrand from "@/components/TrainStationBrand";
import { usePurchaseAuth } from "@/hooks/usePurchaseAuth";
import {
  LANDING_NAV_SECTIONS,
  buildMembershipNavItems,
  landingNavHref,
  type LandingMembershipNavItem,
} from "@/lib/landing-nav";
import { logoutUrl } from "@/lib/logout-url";
import ThemeModeToggle from "@/components/ThemeModeToggle";
import { purchaseHref, type PurchaseAuth } from "@/lib/member-purchase-path";
import { isStaffRole } from "@/lib/staff-access";
import { openFreeQuickTour } from "@/lib/free-quick-tour";
import { openLandingExplore } from "@/lib/landing-explore";
import {
  JOIN_TICKETS_HREF,
  JOIN_WEEK_HREF,
  fireLandingJoinHook,
  markLandingConverted,
  markLandingReturnPending,
  trackLandingCustom,
} from "@/lib/landing-return-visit";

export default function LandingNav({
  variant = "public",
  purchaseAuth: purchaseAuthProp,
  overHero = false,
}: {
  variant?: "public" | "welcome";
  purchaseAuth?: PurchaseAuth;
  /** Transparent cinematic bar over the cold-traffic hero (SMS first screen). */
  overHero?: boolean;
}) {
  const pathname = usePathname();
  const onHomePage = pathname === "/";
  const [membershipsOpen, setMembershipsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [heroSolid, setHeroSolid] = useState(false);
  const menuConvertedRef = useRef(false);
  const [memberships, setMemberships] = useState<LandingMembershipNavItem[]>(() =>
    buildMembershipNavItems(null),
  );
  const purchaseAuth = usePurchaseAuth(purchaseAuthProp);

  useEffect(() => {
    if (!overHero) {
      setHeroSolid(false);
      return;
    }
    const sync = () => setHeroSolid(window.scrollY > 56);
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, [overHero]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/pricing/public");
        if (!res.ok) return;
        const body = await res.json();
        if (cancelled || !Array.isArray(body.tickets)) return;
        setMemberships(buildMembershipNavItems(body.tickets));
      } catch {
        // Static fallback from buildMembershipNavItems(null).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function noteMenuItem() {
    menuConvertedRef.current = true;
  }

  function noteConverted() {
    menuConvertedRef.current = true;
    markLandingConverted();
  }

  function closeMenus() {
    const wasOpen = mobileOpen;
    setMembershipsOpen(false);
    setMobileOpen(false);
    if (wasOpen && !purchaseAuth.signedIn && !menuConvertedRef.current) {
      markLandingReturnPending();
      trackLandingCustom("menu_abandon");
    }
  }

  function openMobileMenu() {
    menuConvertedRef.current = false;
    setMobileOpen(true);
    if (!purchaseAuth.signedIn) {
      trackLandingCustom("menu_open");
    }
  }

  function scrollToHash(href: string) {
    closeMenus();
    if (!href.startsWith("#")) return;
    if (!onHomePage) return;
    openLandingExplore();
    window.setTimeout(() => {
      document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function membershipAction(tier: LandingMembershipNavItem) {
    noteConverted();
    closeMenus();
    if (purchaseAuth.signedIn) {
      window.location.href = purchaseHref(tier.signupPlan, purchaseAuth);
      return;
    }
    window.location.href = tier.signupHref || tier.href || "/join";
  }

  const isWelcome = variant === "welcome";
  /** Photo wash + light type only at the top of the hero. After scroll or when
   *  the hamburger is open, use solid themed chrome so light/dark both read. */
  const cinematic = overHero && !heroSolid && !mobileOpen;
  /** Signed-in members should not re-enter marketing/join surfaces from the nav. */
  const memberHomeHref = purchaseAuth.role && isStaffRole(purchaseAuth.role) ? "/admin" : "/member/today";
  /** Home logo stays on the landing — Join / Start membership live in the hero only. */
  const brandHref = purchaseAuth.signedIn ? memberHomeHref : "/";
  /** Guest home: no white Join pill, no extra top CTAs. Hero has the three choices. */
  const guestHome = onHomePage && !purchaseAuth.signedIn && variant === "public";

  return (
    <header
      data-landing-nav=""
      className={`landing-nav sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-md ${
        cinematic ? "landing-nav--over-hero" : ""
      }`}
    >
      {/*
        Mobile welcome: [logo] [Memberships · Sign out] …… [theme] [☰]
        No Dashboard pill (primary actions live on the page body).
      */}
      <div className="mx-auto flex max-w-6xl items-center gap-1.5 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
          <Link
            href={brandHref}
            className="flex min-w-0 shrink-0 items-center gap-2 transition hover:opacity-90"
            aria-label={
              purchaseAuth.signedIn
                ? "The Train Station — Today"
                : "The Train Station home"
            }
            data-analytics-action="logo-home"
            onClick={() => {
              closeMenus();
            }}
          >
            <span className="md:hidden">
              <TrainStationBrand variant="icon" />
            </span>
            <span className="hidden md:block">
              <TrainStationBrand variant="header" />
            </span>
            <span className="landing-nav__wordmark hidden max-w-[10.5rem] text-[11px] font-semibold uppercase leading-tight tracking-[0.14em] text-[var(--text)] sm:inline md:hidden">
              The Train Station
            </span>
          </Link>

          {isWelcome ? (
            <div className="flex min-w-0 items-center gap-0.5 sm:gap-1">
              {purchaseAuth.signedIn ? (
                <>
                  <Link
                    href={memberHomeHref}
                    className="landing-nav__link landing-nav__link--compact"
                    onClick={closeMenus}
                  >
                    Today
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = logoutUrl();
                    }}
                    className="landing-nav__link landing-nav__link--compact"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <Link
                  href="/join"
                  className="landing-nav__link landing-nav__link--compact"
                  onClick={closeMenus}
                >
                  Memberships
                </Link>
              )}
            </div>
          ) : null}

          <nav className={`ml-1 hidden items-center gap-1 md:flex ${guestHome ? "!hidden" : ""}`}>
            {LANDING_NAV_SECTIONS.map((section) => (
              <Link
                key={section.id}
                href={landingNavHref(section.href, onHomePage)}
                onClick={(e) => {
                  if (onHomePage && section.href.startsWith("#")) {
                    e.preventDefault();
                    scrollToHash(section.href);
                  }
                }}
                className="landing-nav__link"
              >
                {section.label}
              </Link>
            ))}

            {!isWelcome && !purchaseAuth.signedIn ? (
              <div
                className="relative"
                onMouseEnter={() => setMembershipsOpen(true)}
                onMouseLeave={() => setMembershipsOpen(false)}
              >
                <Link
                  href={JOIN_TICKETS_HREF}
                  className="landing-nav__link"
                  data-analytics-action="nav-memberships"
                  onClick={() => {
                    noteConverted();
                    closeMenus();
                  }}
                >
                  Memberships
                </Link>
                {membershipsOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1 min-w-[15rem] rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-xl">
                    {memberships.map((tier) => (
                      <Link
                        key={tier.id}
                        href={tier.signupHref}
                        onClick={(e) => {
                          e.preventDefault();
                          membershipAction(tier);
                        }}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-sm transition hover:bg-[var(--surface-2)]"
                      >
                        <span className="font-medium text-[var(--text)]">{tier.shortLabel}</span>
                        <span className="text-xs text-[var(--muted)]">{tier.priceDisplay}</span>
                      </Link>
                    ))}
                    <div className="my-1 border-t border-[var(--border)]" />
                    <Link
                      href={JOIN_TICKETS_HREF}
                      onClick={() => {
                        noteConverted();
                        closeMenus();
                      }}
                      className="block px-3 py-2 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--surface-2)]"
                    >
                      All ticket levels →
                    </Link>
                  </div>
                )}
              </div>
            ) : null}
            {!isWelcome && purchaseAuth.signedIn ? (
              <Link href={memberHomeHref} className="landing-nav__link" onClick={closeMenus}>
                Today
              </Link>
            ) : null}
            {/* Desktop has no hamburger — keep Sign in available (muted). Free Tour is top-right. */}
            {!isWelcome && !purchaseAuth.signedIn ? (
              <Link href="/login" className="landing-nav__link text-[var(--muted)]" onClick={closeMenus}>
                Sign in
              </Link>
            ) : null}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          {variant === "public" ? (
            purchaseAuth.signedIn ? (
              <Link
                href={memberHomeHref}
                className={`btn-primary hidden px-4 py-2 text-xs font-bold md:inline-flex ${cinematic ? "sm:inline-flex" : ""}`}
                onClick={closeMenus}
              >
                Open Today
              </Link>
            ) : guestHome ? null : (
              <>
                <button
                  type="button"
                  data-analytics-action="nav-free-tour"
                  className={`landing-nav__link hidden font-semibold sm:inline-flex ${
                    cinematic ? "text-white/95" : "text-[var(--accent-fg)]"
                  }`}
                  onClick={() => {
                    noteConverted();
                    closeMenus();
                    openFreeQuickTour();
                  }}
                >
                  Free Tour
                </button>
                <Link
                  href={JOIN_WEEK_HREF}
                  data-analytics-action="nav-join-week"
                  onClick={(e) => {
                    noteConverted();
                    fireLandingJoinHook(e.currentTarget);
                  }}
                  className="landing-nav__join btn-primary inline-flex h-8 items-center rounded-full px-3 text-[11px] font-extrabold sm:h-9 sm:px-4 sm:text-xs"
                >
                  Start membership
                </Link>
              </>
            )
          ) : null}
          {/* Theme lives in-nav so it never sits on the hamburger */}
          <div className="global-theme-toggle">
            <ThemeModeToggle />
          </div>
          <button
            type="button"
            className={`landing-nav__menu-btn ${guestHome ? "" : "md:hidden"}`}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            data-analytics-action={mobileOpen ? "close-menu" : "open-menu"}
            onClick={() => {
              if (mobileOpen) closeMenus();
              else openMobileMenu();
            }}
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className={`border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] ${guestHome ? "" : "md:hidden"}`}>
          <div className="space-y-1">
            {LANDING_NAV_SECTIONS.map((section) => (
              <Link
                key={section.id}
                href={landingNavHref(section.href, onHomePage)}
                onClick={(e) => {
                  noteMenuItem();
                  if (onHomePage && section.href.startsWith("#")) {
                    e.preventDefault();
                    scrollToHash(section.href);
                  }
                  closeMenus();
                }}
                className="block rounded-lg px-2 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-2)]"
              >
                {section.label}
              </Link>
            ))}
            {purchaseAuth.signedIn ? (
              <>
                <a
                  href={memberHomeHref}
                  className="block rounded-lg px-2 py-2 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--surface-2)]"
                  onClick={closeMenus}
                >
                  Today
                </a>
                <a
                  href={memberHomeHref}
                  className="block rounded-lg px-2 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-2)]"
                  onClick={closeMenus}
                >
                  Open dashboard
                </a>
                <Link
                  href="/member/account"
                  className="block rounded-lg px-2 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-2)]"
                  onClick={closeMenus}
                >
                  Account &amp; billing
                </Link>
                <Link
                  href="/member/programs"
                  className="block rounded-lg px-2 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-2)]"
                  onClick={closeMenus}
                >
                  My programs
                </Link>
                <button
                  type="button"
                  className="block w-full rounded-lg px-2 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--surface-2)]"
                  onClick={() => {
                    window.location.href = logoutUrl();
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  data-analytics-action="menu-free-tour"
                  className="block w-full rounded-lg px-2 py-2 text-left text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--surface-2)]"
                  onClick={() => {
                    noteConverted();
                    closeMenus();
                    openFreeQuickTour();
                  }}
                >
                  Free Tour
                </button>
                <Link
                  href={JOIN_WEEK_HREF}
                  data-analytics-action="menu-join-week"
                  className="block rounded-lg px-2 py-2 text-sm font-bold text-[var(--text)] hover:bg-[var(--surface-2)]"
                  onClick={(e) => {
                    noteConverted();
                    fireLandingJoinHook(e.currentTarget);
                    closeMenus();
                  }}
                >
                  Start membership
                </Link>
                <Link
                  href="/login"
                  data-analytics-action="menu-sign-in"
                  className="block rounded-lg px-2 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-2)]"
                  onClick={() => {
                    noteConverted();
                    closeMenus();
                  }}
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
          {!purchaseAuth.signedIn ? (
          <div className="mt-3 border-t border-[var(--border)] pt-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
              Memberships
            </p>
            <div className="space-y-1">
              {memberships.map((tier) => (
                <Link
                  key={tier.id}
                  href={tier.signupHref}
                  onClick={(e) => {
                    e.preventDefault();
                    membershipAction(tier);
                  }}
                  className="flex items-center justify-between rounded-lg px-2 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-2)]"
                >
                  <span>{tier.shortLabel}</span>
                  <span className="text-xs text-[var(--muted)]">{tier.priceDisplay}</span>
                </Link>
              ))}
              <Link
                href={JOIN_TICKETS_HREF}
                onClick={() => {
                  noteConverted();
                  closeMenus();
                }}
                className="block rounded-lg px-2 py-2 text-xs font-semibold text-[var(--accent-fg)] hover:bg-[var(--surface-2)]"
              >
                Compare plans →
              </Link>
            </div>
          </div>
          ) : null}
        </div>
      )}
    </header>
  );
}