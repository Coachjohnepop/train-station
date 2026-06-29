import Link from "next/link";
import AdminAreaNav from "@/components/AdminAreaNav";
import TrainStationBrand from "@/components/TrainStationBrand";
import DevModeSwitcher from "@/components/DevModeSwitcher";
import LogoutButton from "@/components/LogoutButton";
import { getSessionUser } from "@/lib/auth";
import {
  canAccessCoachAdmin,
  canAccessPlatformAdmin,
  hasDualStaffWorkspace,
  staffWorkspaceLabel,
} from "@/lib/staff-access";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionUser();
  const role = session?.role;
  const dualWorkspace = role ? hasDualStaffWorkspace(role) : false;
  const canCoach = role ? canAccessCoachAdmin(role) : false;
  const canPlatform = role ? canAccessPlatformAdmin(role) : false;
  const areaLabel = role ? staffWorkspaceLabel(role) : "Staff";

  return (
    <div className="app-shell-bg flex min-h-screen flex-col lg:flex-row">
      <DevModeSwitcher active="admin" staffSession={session} />
      <aside className="app-shell-header lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-56 lg:shrink-0 lg:flex-col lg:border-r lg:border-[var(--border)]">
        <div className="flex flex-col gap-4 px-4 py-4 lg:px-3 lg:py-5">
          <div className="flex items-center justify-between gap-2 lg:flex-col lg:items-stretch">
            <Link href="/admin" className="transition hover:opacity-90">
              <TrainStationBrand variant="header" className="!h-7 sm:!h-8" />
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
          <div className="max-h-[50vh] overflow-y-auto lg:max-h-none lg:flex-1 lg:overflow-y-auto">
            <AdminAreaNav
              dualWorkspace={dualWorkspace}
              canCoach={canCoach}
              canPlatform={canPlatform}
            />
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6 md:py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}