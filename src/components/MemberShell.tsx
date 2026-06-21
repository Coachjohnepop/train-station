import Link from "next/link";
import DevModeSwitcher from "@/components/DevModeSwitcher";
import MemberNav from "@/components/MemberNav";
import LogoutButton from "@/components/LogoutButton";
import type { MemberAccess } from "@/lib/access";
import type { SessionUser } from "@/lib/auth-session";

export default function MemberShell({
  children,
  access,
  memberName,
  memberEmail,
  staffSession,
}: {
  children: React.ReactNode;
  access: MemberAccess;
  memberName: string;
  memberEmail?: string;
  staffSession?: SessionUser | null;
}) {
  return (
    <div className="app-shell-bg flex min-h-screen flex-col">
      <DevModeSwitcher active="member" staffSession={staffSession} />
      <header className="app-shell-header">
        <div className="mx-auto flex w-full max-w-lg md:max-w-3xl lg:max-w-6xl xl:max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/member" className="text-sm font-semibold tracking-tight text-[var(--foreground)] hover:text-[var(--accent)]">
              The Train Station
            </Link>
            <div>
              <p className="text-sm font-medium">Hi, {memberName}</p>
              {memberEmail && <p className="text-[10px] text-[var(--muted)]">{memberEmail}</p>}
            </div>
          </div>
          <div className="text-right">
            <span className="badge-accent inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold">
              {access.tierLabel}
            </span>
            <div className="mt-1">
              <LogoutButton />
            </div>
          </div>
        </div>
        <MemberNav />
      </header>

      <main className="mx-auto w-full max-w-lg md:max-w-3xl lg:max-w-6xl xl:max-w-7xl flex-1 px-4 py-6 md:px-6 lg:px-8">{children}</main>
    </div>
  );
}