import Link from "next/link";
import { Suspense } from "react";
import IntakeBookingCelebrate from "@/components/IntakeBookingCelebrate";
import LiveZoomJoinPrompt from "@/components/LiveZoomJoinPrompt";
import ResumePathTracker from "@/components/ResumePathTracker";

import MemberNav from "@/components/MemberNav";
import MemberHeaderHomeLink from "@/components/MemberHeaderHomeLink";
import LogoutButton from "@/components/LogoutButton";
import ThemeAttributesSync from "@/components/ThemeAttributesSync";

import {
  MEMBERSHIP_THEME_LABELS,
  type MembershipThemeTier,
} from "@/lib/membership-theme";
import type { SignupPlan } from "@/lib/signup-plans";

export default function MemberShell({
  children,
  tierLabel: tierLabelProp,
  memberName,
  memberEmail,
  membershipTier,
  intakePending = false,
  paymentGateActive = false,
  checkoutPlan = "member",
}: {
  children: React.ReactNode;
  tierLabel?: string;
  memberName: string;
  memberEmail?: string;
  membershipTier: MembershipThemeTier;
  intakePending?: boolean;
  paymentGateActive?: boolean;
  checkoutPlan?: SignupPlan;
}) {
  const tierLabel = MEMBERSHIP_THEME_LABELS[membershipTier] || tierLabelProp || "Member";

  return (
    <div className="app-shell-bg flex min-h-screen flex-col">
      <Suspense fallback={null}>
        <ResumePathTracker area="member" />
      </Suspense>
      <ThemeAttributesSync membershipTier={membershipTier} />
      <header className="app-shell-header header-theme-clearance">
        <div className="mx-auto flex w-full max-w-lg md:max-w-3xl lg:max-w-6xl xl:max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <MemberHeaderHomeLink />
            <div>
              <p className="text-sm font-medium">Hi, {memberName}</p>
              {memberEmail && <p className="text-[10px] text-[var(--muted)]">{memberEmail}</p>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <span className="badge-accent inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold">
                {tierLabel}
              </span>
            </div>
            <LogoutButton />
          </div>
        </div>
        <MemberNav
          intakePending={intakePending}
          paymentGateActive={paymentGateActive}
          checkoutPlan={checkoutPlan}
        />
      </header>

      {paymentGateActive ? (
        <p className="mx-auto w-full max-w-lg border-b border-amber-500/25 bg-amber-500/10 px-4 py-2 text-center text-[11px] text-amber-100 md:max-w-3xl lg:max-w-6xl xl:max-w-7xl md:px-6 lg:px-8">
          Complete your ticket to unlock Today&apos;s workout and scores. Messages and Book Call stay
          open.
        </p>
      ) : null}

      <main className="mx-auto w-full min-w-0 max-w-lg overflow-x-clip md:max-w-3xl lg:max-w-6xl xl:max-w-7xl flex-1 px-4 py-6 md:px-6 lg:px-8">{children}</main>
      <Suspense fallback={null}>
        <LiveZoomJoinPrompt />
      </Suspense>
      <IntakeBookingCelebrate />
    </div>
  );
}