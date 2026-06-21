import MemberShell from "@/components/MemberShell";
import { getMemberDashboard } from "@/lib/member-context";
import { getSessionUser } from "@/lib/auth";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dashboard, session] = await Promise.all([getMemberDashboard(), getSessionUser()]);
  const access = dashboard?.access ?? {
    tier: "coach" as const,
    isPreview: true,
    tierLabel: "Coach Class",
    canAccessProgram: () => true,
    canAccessFeature: () => true,
  };
  const name = session?.name || dashboard?.user.name || "Member";
  const email = session?.email || dashboard?.user.email;

  return (
    <MemberShell access={access} memberName={name} memberEmail={email}>
      {children}
    </MemberShell>
  );
}