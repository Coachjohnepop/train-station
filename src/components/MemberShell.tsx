import { Suspense } from "react";
import IntakeBookingCelebrate from "@/components/IntakeBookingCelebrate";
import LiveZoomJoinPrompt from "@/components/LiveZoomJoinPrompt";
import MemberLiveZoomStrip from "@/components/MemberLiveZoomStrip";
import MemberZoomHeaderButton from "@/components/MemberZoomHeaderButton";
import MemberMaintainResumeStrip from "@/components/MemberMaintainResumeStrip";
import ResumePathTracker from "@/components/ResumePathTracker";
import UnreadAppBadge from "@/components/UnreadAppBadge";
import PwaInstallHint from "@/components/PwaInstallHint";
import PushAlertEnable from "@/components/PushAlertEnable";

import MemberNav from "@/components/MemberNav";
import MemberHeaderHomeLink from "@/components/MemberHeaderHomeLink";
import MemberGateCookieSync from "@/components/MemberGateCookieSync";
import SiteSeenLatch from "@/components/SiteSeenLatch";
import DisablePullToRefresh from "@/components/DisablePullToRefresh";
import LogoutButton from "@/components/LogoutButton";
import ThemeAttributesSync from "@/components/ThemeAttributesSync";
import ThemeModeToggle from "@/components/ThemeModeToggle";
import UserBicepAvatar from "@/components/UserBicepAvatar";
import Link from "next/link";

import {
  MEMBERSHIP_THEME_LABELS,
  type MembershipThemeTier,
} from "@/lib/membership-theme";
import type { SignupPlan } from "@/lib/signup-plans";
import { memberCheckoutPath } from "@/lib/member-route-gates";

export default function MemberShell({
  children,
  tierLabel: tierLabelProp,
  memberName,
  memberEmail,
  memberUserId = null,
  membershipTier,
  intakePending = false,
  paymentGateActive = false,
  checkoutPlan = "member",
  /** Setup wizard: hide Live Class / maintain chrome so video fits on phone. */
  setupMode = false,
  /** First visit to the site (not a returning member). Slim chrome until setup is done. */
  newbieMode = false,
}: {
  children: React.ReactNode;
  tierLabel?: string;
  memberName: string;
  memberEmail?: string;
  /** Logged-in member id — powers maintain resume strip. */
  memberUserId?: string | null;
  membershipTier: MembershipThemeTier;
  intakePending?: boolean;
  paymentGateActive?: boolean;
  checkoutPlan?: SignupPlan;
  setupMode?: boolean;
  newbieMode?: boolean;
}) {
  const tierLabel = MEMBERSHIP_THEME_LABELS[membershipTier] || tierLabelProp || "Member";
  const hideMemberNav = setupMode || newbieMode || paymentGateActive;
  const showContinueSetup = newbieMode && !setupMode && !paymentGateActive;

  return (
    <div className="app-shell-bg member-app flex min-h-screen flex-col">
      <MemberGateCookieSync />
      <SiteSeenLatch established={!newbieMode} />
      <DisablePullToRefresh />
      <Suspense fallback={null}>
        <ResumePathTracker area="member" />
      </Suspense>
      <ThemeAttributesSync membershipTier={membershipTier} />

      {/* Frozen top chrome: greeting + Today/Messages nav (and live strip) stay visible while session scrolls.
          data-member-chrome hides the root fixed theme toggle so it doesn’t sit on Business Class / Sign out. */}
      <div className="member-sticky-chrome sticky top-0 z-50" data-member-chrome="">
        <header className="app-shell-header">
          <div className="member-chrome-bar mx-auto flex w-full max-w-lg items-center justify-between gap-3 px-4 py-3 md:max-w-3xl md:px-6 lg:max-w-6xl lg:px-8 xl:max-w-7xl">
            <div className="member-chrome-identity flex min-w-0 items-center gap-2.5 sm:gap-3">
              <div className="member-chrome-brand">
                <MemberHeaderHomeLink
                  setupHref={
                    paymentGateActive
                      ? memberCheckoutPath(checkoutPlan)
                      : hideMemberNav
                        ? "/member/onboard"
                        : undefined
                  }
                />
              </div>
              {setupMode ? (
                <div className="member-chrome-user flex min-w-0 items-center gap-2">
                  <UserBicepAvatar size={34} title="Account" className="member-chrome-avatar" />
                  <div className="member-chrome-hello min-w-0">
                    <p className="member-chrome-name truncate text-sm font-medium">Hi, {memberName}</p>
                    {memberEmail && (
                      <p className="member-chrome-email truncate text-xs text-[var(--muted)]">{memberEmail}</p>
                    )}
                  </div>
                </div>
              ) : (
                <Link
                  href="/member/account"
                  className="member-chrome-user flex min-w-0 items-center gap-2 rounded-lg transition hover:opacity-90"
                  title="Account & settings"
                >
                  <UserBicepAvatar size={34} title="Account" className="member-chrome-avatar" />
                  <div className="member-chrome-hello min-w-0">
                    <p className="member-chrome-name truncate text-sm font-medium">Hi, {memberName}</p>
                    {memberEmail && (
                      <p className="member-chrome-email truncate text-xs text-[var(--muted)]">{memberEmail}</p>
                    )}
                  </div>
                </Link>
              )}
            </div>
            <div className="member-chrome-actions flex shrink-0 items-center gap-1.5 sm:gap-2.5">
              {!setupMode && !paymentGateActive ? (
                <MemberZoomHeaderButton
                  membershipPlan={
                    membershipTier === "explorer"
                      ? "explorer"
                      : membershipTier === "member"
                        ? "member"
                        : membershipTier === "business"
                          ? "business"
                          : membershipTier === "pro"
                            ? "pro"
                            : "explorer"
                  }
                />
              ) : null}
              <span className="member-chrome-tier badge-accent inline-block max-w-[7.5rem] truncate rounded-full px-2 py-0.5 text-xs font-semibold leading-tight tracking-wide sm:max-w-none">
                {tierLabel}
              </span>
              {/* Reuse .global-theme-toggle so label stays icon-only on narrow screens */}
              <div className="global-theme-toggle">
                <ThemeModeToggle />
              </div>
              <LogoutButton className="member-chrome-logout text-sm" />
            </div>
          </div>
          {hideMemberNav ? null : (
            <MemberNav
              intakePending={intakePending}
              paymentGateActive={paymentGateActive}
              checkoutPlan={checkoutPlan}
            />
          )}
        </header>

        {showContinueSetup ? (
          <p className="mx-auto w-full max-w-lg border-b border-[#7c3aed]/30 bg-[#7c3aed]/10 px-4 py-2 text-center text-[12px] text-[var(--text)] md:max-w-3xl lg:max-w-6xl xl:max-w-7xl md:px-6 lg:px-8">
            Finish setup to unlock Today.{" "}
            <Link href="/member/onboard" className="font-semibold text-accent hover:underline">
              Continue setup →
            </Link>
          </p>
        ) : null}

        {paymentGateActive ? (
          <p className="mx-auto w-full max-w-lg border-b border-amber-500/25 bg-amber-500/10 px-4 py-2 text-center text-[11px] text-amber-100 md:max-w-3xl lg:max-w-6xl xl:max-w-7xl md:px-6 lg:px-8">
            Complete your ticket to unlock Today&apos;s workout and scores. Messages and Book Call stay
            open.
          </p>
        ) : null}

        {/* In-progress maintain: top action banner (above Live Class) so it never gets lost */}
        {!setupMode && !paymentGateActive && memberUserId ? (
          <Suspense fallback={null}>
            <MemberMaintainResumeStrip memberUserId={memberUserId} embedded />
          </Suspense>
        ) : null}

        {/* Live Class strip is noise during first-time onboard on a phone */}
        {!setupMode && !paymentGateActive ? (
          <div className="member-live-strip">
            <Suspense fallback={null}>
              <MemberLiveZoomStrip
                embedded
                membershipPlan={
                  membershipTier === "explorer"
                    ? "explorer"
                    : membershipTier === "member"
                      ? "member"
                      : membershipTier === "business"
                        ? "business"
                        : membershipTier === "pro"
                          ? "pro"
                          : "explorer"
                }
              />
            </Suspense>
          </div>
        ) : null}
      </div>

      <main
        className={`mx-auto w-full min-w-0 max-w-lg flex-1 overflow-x-clip md:max-w-3xl lg:max-w-6xl xl:max-w-7xl md:px-6 lg:px-8 ${
          setupMode ? "px-0 py-2 md:px-6 md:py-6" : "px-4 py-6"
        }`}
      >
        {!setupMode ? (
          <div className="member-aux-hints mb-3 space-y-2 px-4 md:px-0">
            <PwaInstallHint compact />
            <PushAlertEnable compact />
          </div>
        ) : null}
        {children}
      </main>
      <Suspense fallback={null}>
        <LiveZoomJoinPrompt />
      </Suspense>
      <IntakeBookingCelebrate />
      {/* Home-screen icon badge + whistle when unread increases */}
      <UnreadAppBadge role="member" />
    </div>
  );
}