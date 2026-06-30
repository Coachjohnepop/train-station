"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import ThemeModeToggle from "@/components/ThemeModeToggle";
import TrainStationBrand from "@/components/TrainStationBrand";
import { usePurchaseAuth } from "@/hooks/usePurchaseAuth";
import {
  LANDING_NAV_SECTIONS,
  buildMembershipNavItems,
  landingNavHref,
  type LandingMembershipNavItem,
} from "@/lib/landing-nav";
import { logoutUrl } from "@/lib/logout-url";
import { isStaffRole } from "@/lib/auth-session";
import { purchaseHref, type PurchaseAuth } from "@/lib/member-purchase-path";

export default function LandingNav({
  variant = "public",
  purchaseAuth: purchaseAuthProp,
}: {
  variant?: "public" | "welcome";
  purchaseAuth?: PurchaseAuth;
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
    if (purchaseAuth.signedIn) {
      closeMenus();
      window.location.href = purchaseHref(tier.signupPlan, purchaseAuth);
      return;
    }
    if (onHomePage && tier.href.startsWith("#")) {
      scrollToHash(tier.href);
      return;
    }
    closeMenus();
  }

  return (
    <header className="landing-nav sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="shrink-0 transition hover:opacity-90" onClick={closeMenus}>
          <TrainStationBrand variant="header" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <div
            className="relative"
            onMouseEnter={() => setMembershipsOpen(true)}
            onMouseLeave={() => setMembershipsOpen(false)}
          >
            <Link
              href={landingNavHref("#tickets", onHomePage)}
              onClick={(e) => {
                if (onHomePage) {
                  e.preventDefault();
                  scrollToHash("#tickets");
                }
              }}
              className="landing-nav__link"
            >
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
                        : landingNavHref(tier.href, onHomePage)
                    }
                    onClick={(e) => {
                      if (purchaseAuth.signedIn || (onHomePage && tier.href.startsWith("#"))) {
                        e.preventDefault();
                        membershipAction(tier);
                      }
                    }}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm transition hover:bg-[var(--surface-2)]"
                  >
                    <span className="font-medium text-[var(--text)]">{tier.shortLabel}</span>
                    <span className="text-xs text-[var(--muted)]">{tier.priceDisplay}</span>
                  </Link>
                ))}
                <div className="my-1 border-t border-[var(--border)]" />
                <Link
                  href={landingNavHref("#tickets", onHomePage)}
                  onClick={(e) => {
                    if (onHomePage) {
                      e.preventDefault();
                      scrollToHash("#tickets");
                    }
                  }}
                  className="block px-3 py-2 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--surface-2)]"
                >
                  Compare all tickets →
                </Link>
              </div>
            )}
          </div>

          {LANDING_NAV_SECTIONS.filter((s) => s.id !== "tickets").map((section) => (
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
        </nav>

        <div className="flex items-center gap-2">
          {variant === "welcome" && purchaseAuth.signedIn ? (
            <Link
              href={purchaseAuth.role && isStaffRole(purchaseAuth.role) ? "/admin" : "/member"}
              className="btn-primary px-3 py-1.5 text-[11px] font-semibold md:hidden"
            >
              Open Dashboard
            </Link>
          ) : null}
          <ThemeModeToggle className="hidden sm:inline-flex" />
          {variant === "public" ? (
            <>
              <Link href="/login" className="landing-nav__link hidden sm:inline-flex">
                Sign in
              </Link>
              <Link href="/signup?plan=explorer" className="btn-primary hidden px-4 py-2 text-xs sm:inline-flex">
                Get started
              </Link>
            </>
          ) : (
            <>
              <Link href="/#tickets" className="landing-nav__link hidden sm:inline-flex">
                Memberships
              </Link>
              <button
                type="button"
                onClick={() => {
                  window.location.href = logoutUrl();
                }}
                className="landing-nav__link hidden sm:inline-flex"
              >
                Sign out
              </button>
            </>
          )}
          <button
            type="button"
            className="landing-nav__menu-btn md:hidden"
            aria-expanded={mobileOpen}
            aria-label="Open menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 md:hidden">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
            Memberships
          </p>
          <div className="space-y-1">
            {memberships.map((tier) => (
              <Link
                key={tier.id}
                href={
                  purchaseAuth.signedIn
                    ? purchaseHref(tier.signupPlan, purchaseAuth)
                    : landingNavHref(tier.href, onHomePage)
                }
                onClick={(e) => {
                  if (purchaseAuth.signedIn || (onHomePage && tier.href.startsWith("#"))) {
                    e.preventDefault();
                    membershipAction(tier);
                  } else {
                    closeMenus();
                  }
                }}
                className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-[var(--surface-2)]"
              >
                <span>{tier.shortLabel}</span>
                <span className="text-xs text-[var(--muted)]">{tier.priceDisplay}</span>
              </Link>
            ))}
          </div>
          <div className="mt-3 space-y-1 border-t border-[var(--border)] pt-3">
            {LANDING_NAV_SECTIONS.filter((s) => s.id !== "tickets").map((section) => (
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
            <Link href="/login" className="block rounded-lg px-2 py-2 text-sm hover:bg-[var(--surface-2)]">
              Sign in
            </Link>
            <div className="pt-2">
              <ThemeModeToggle />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}