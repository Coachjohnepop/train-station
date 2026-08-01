"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  const [memberships, setMemberships] = useState<LandingMembershipNavItem[]>(() =>
    buildMembershipNavItems(null),
  );
  const purchaseAuth = usePurchaseAuth(purchaseAuthProp);

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

  function closeMenus() {
    setMembershipsOpen(false);
    setMobileOpen(false);
  }

  function scrollToHash(href: string) {
    closeMenus();
    if (!href.startsWith("#")) return;
    if (!onHomePage) return;
    const el = document.querySelector(href);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function membershipAction(tier: LandingMembershipNavItem) {
    closeMenus();
    if (purchaseAuth.signedIn) {
      window.location.href = purchaseHref(tier.signupPlan, purchaseAuth);
      return;
    }
    window.location.href = tier.signupHref || tier.href || "/join";
  }

  const isWelcome = variant === "welcome";

  return (
    <header
      data-landing-nav=""
      className={`landing-nav sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-md ${
        overHero ? "landing-nav--over-hero" : ""
      }`}
    >
      {/*
        Mobile welcome: [logo] [Memberships · Sign out] …… [theme] [☰]
        No Dashboard pill (primary actions live on the page body).
      */}
      <div className="mx-auto flex max-w-6xl items-center gap-1.5 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
          <Link
            href="/"
            className="flex min-w-0 shrink-0 items-center gap-2 transition hover:opacity-90"
            onClick={closeMenus}
          >
            <span className="md:hidden">
              <TrainStationBrand variant="icon" />
            </span>
            <span className="hidden md:block">
              <TrainStationBrand variant="header" />
            </span>
            <span className="hidden max-w-[10.5rem] text-[11px] font-semibold uppercase leading-tight tracking-[0.14em] text-[var(--text)] sm:inline md:hidden">
              The Train Station
            </span>
          </Link>

          {isWelcome ? (
            <div className="flex min-w-0 items-center gap-0.5 sm:gap-1">
              <Link
                href="/join"
                className="landing-nav__link landing-nav__link--compact"
                onClick={closeMenus}
              >
                Memberships
              </Link>
              {purchaseAuth.signedIn ? (
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = logoutUrl();
                  }}
                  className="landing-nav__link landing-nav__link--compact"
                >
                  Sign out
                </button>
              ) : null}
            </div>
          ) : null}

          <nav className="ml-1 hidden items-center gap-1 md:flex">
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

            {!isWelcome ? (
              <div
                className="relative"
                onMouseEnter={() => setMembershipsOpen(true)}
                onMouseLeave={() => setMembershipsOpen(false)}
              >
                <Link href="/join#tickets" className="landing-nav__link" onClick={closeMenus}>
                  Memberships
                </Link>
                {membershipsOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1 min-w-[15rem] rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-xl">
                    {memberships.map((tier) => (
                      <Link
                        key={tier.id}
                        href={
                          purchaseAuth.signedIn
                            ? purchaseHref(tier.signupPlan, purchaseAuth)
                            : tier.signupHref
                        }
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
                      href="/join#tickets"
                      onClick={closeMenus}
                      className="block px-3 py-2 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--surface-2)]"
                    >
                      All ticket levels →
                    </Link>
                  </div>
                )}
              </div>
            ) : null}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          {variant === "public" ? (
            <>
              <Link
                href="/login"
                className={`landing-nav__link ${overHero ? "hidden sm:inline-flex text-white/90" : "hidden md:inline-flex"}`}
              >
                Sign in
              </Link>
              {!overHero ? (
                <Link
                  href="/join#tickets"
                  className="btn-primary hidden px-4 py-2 text-xs font-bold md:inline-flex"
                >
                  Choose ticket
                </Link>
              ) : null}
            </>
          ) : null}
          {/* Theme lives in-nav so it never sits on the hamburger */}
          <div className="global-theme-toggle">
            <ThemeModeToggle />
          </div>
          <button
            type="button"
            className="landing-nav__menu-btn md:hidden"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 md:hidden">
          <div className="space-y-1">
            {LANDING_NAV_SECTIONS.map((section) => (
              <Link
                key={section.id}
                href={landingNavHref(section.href, onHomePage)}
                onClick={(e) => {
                  if (onHomePage && section.href.startsWith("#")) {
                    e.preventDefault();
                    scrollToHash(section.href);
                  }
                  closeMenus();
                }}
                className="block rounded-lg px-2 py-2 text-sm hover:bg-[var(--surface-2)]"
              >
                {section.label}
              </Link>
            ))}
            {isWelcome && purchaseAuth.signedIn ? (
              <>
                <a
                  href="/member/today"
                  className="block rounded-lg px-2 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--surface-2)]"
                  onClick={closeMenus}
                >
                  Today
                </a>
                <a
                  href="/member/today"
                  className="block rounded-lg px-2 py-2 text-sm hover:bg-[var(--surface-2)]"
                  onClick={closeMenus}
                >
                  Open dashboard
                </a>
                <Link
                  href="/member/account"
                  className="block rounded-lg px-2 py-2 text-sm hover:bg-[var(--surface-2)]"
                  onClick={closeMenus}
                >
                  Account &amp; billing
                </Link>
                <button
                  type="button"
                  className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-[var(--surface-2)]"
                  onClick={() => {
                    window.location.href = logoutUrl();
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/join#tickets"
                  className="block rounded-lg px-2 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--surface-2)]"
                  onClick={closeMenus}
                >
                  Choose your ticket
                </Link>
                <Link
                  href="/login"
                  className="block rounded-lg px-2 py-2 text-sm hover:bg-[var(--surface-2)]"
                  onClick={closeMenus}
                >
                  Member sign in
                </Link>
              </>
            )}
          </div>
          <div className="mt-3 border-t border-[var(--border)] pt-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
              Memberships
            </p>
            <div className="space-y-1">
              {memberships.map((tier) => (
                <Link
                  key={tier.id}
                  href={
                    purchaseAuth.signedIn
                      ? purchaseHref(tier.signupPlan, purchaseAuth)
                      : tier.signupHref
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    membershipAction(tier);
                  }}
                  className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-[var(--surface-2)]"
                >
                  <span>{tier.shortLabel}</span>
                  <span className="text-xs text-[var(--muted)]">{tier.priceDisplay}</span>
                </Link>
              ))}
              <Link
                href="/join#tickets"
                onClick={closeMenus}
                className="block rounded-lg px-2 py-2 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--surface-2)]"
              >
                Compare plans →
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}