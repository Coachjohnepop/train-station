import Link from "next/link";
import IntakeBookingCelebrate from "@/components/IntakeBookingCelebrate";
import MemberNav from "@/components/MemberNav";
import MemberHeaderHomeLink from "@/components/MemberHeaderHomeLink";
import LogoutButton from "@/components/LogoutButton";
import ThemeAttributesSync from "@/components/ThemeAttributesSync";
import ThemeModeToggle from "@/components/ThemeModeToggle";
import type { MemberAccess } from "@/lib/access";
import {
  MEMBERSHIP_THEME_LABELS,
  type MembershipThemeTier,
} from "@/lib/membership-theme";

export default function MemberShell({
  children,
  access,
  memberName,
  memberEmail,
  membershipTier,
  intakePending = false,
}: {
  children: React.ReactNode;
  access: MemberAccess;
  memberName: string;
  memberEmail?: string;
  membershipTier: MembershipThemeTier;
  intakePending?: boolean;
}) {
  const tierLabel = MEMBERSHIP_THEME_LABELS[membershipTier] || access.tierLabel;

  return (
    <div className="app-shell-bg flex min-h-screen flex-col">
      <ThemeAttributesSync membershipTier={membershipTier} />
      <header className="app-shell-header">
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
              <ThemeModeToggle />
              <span className="badge-accent inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold">
                {tierLabel}
              </span>
            </div>
            <LogoutButton />
          </div>
        </div>
        <MemberNav intakePending={intakePending} />
      </header>

      <main className="mx-auto w-full min-w-0 max-w-lg overflow-x-clip md:max-w-3xl lg:max-w-6xl xl:max-w-7xl flex-1 px-4 py-6 md:px-6 lg:px-8">{children}</main>
      <IntakeBookingCelebrate />
    </div>
  );
}