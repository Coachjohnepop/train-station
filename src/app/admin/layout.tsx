import AdminShell from "@/components/AdminShell";
import { getSessionUser } from "@/lib/auth";
import {
  canAccessCoachAdmin,
  canAccessPlatformAdmin,
  hasDualStaffWorkspace,
  staffWorkspaceLabel,
} from "@/lib/staff-access";
import { allowDevUserSwitcher } from "@/lib/security-config";

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
    <AdminShell
      session={session}
      areaLabel={areaLabel}
      dualWorkspace={dualWorkspace}
      canCoach={canCoach}
      canPlatform={canPlatform}
      showDevSwitcher={allowDevUserSwitcher()}
    >
      {children}
    </AdminShell>
  );
}