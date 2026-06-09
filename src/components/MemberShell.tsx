import Link from "next/link";
import DevModeSwitcher from "@/components/DevModeSwitcher";
import MemberNav from "@/components/MemberNav";
import type { MemberAccess } from "@/lib/access";

export default function MemberShell({
  children,
  access,
  memberName,
}: {
  children: React.ReactNode;
  access: MemberAccess;
  memberName: string;
}) {
  return (
    <div className="app-shell-bg flex min-h-screen flex-col">
      <DevModeSwitcher active="member" />
      <header className="app-shell-header">
        <div className="mx-auto flex w-full max-w-lg md:max-w-3xl lg:max-w-6xl xl:max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:py-3 md:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/member">
              <img
                src="/images/logo-icon.png"
                alt="The Train Station"
                className="h-10 w-auto sm:h-14"
              />
            </Link>
            <p className="text-sm text-[var(--muted)]">Hi, {memberName}</p>
          </div>
          <div className="text-right">
            <span className="badge-accent inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold">
              {access.tierLabel}
            </span>
            {access.isPreview && (
              <p className="mt-1 text-[10px] text-[var(--muted)]">
                Full access preview
              </p>
            )}
          </div>
        </div>
        <MemberNav />
      </header>

      <main className="app-main-safe mx-auto w-full max-w-lg md:max-w-3xl lg:max-w-6xl xl:max-w-7xl flex-1 px-4 py-6 md:px-6 lg:px-8">{children}</main>
    </div>
  );
}