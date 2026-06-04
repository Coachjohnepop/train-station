import MemberShell from "@/components/MemberShell";
import { getMemberDashboard } from "@/lib/member-context";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const dashboard = await getMemberDashboard();
  const access = dashboard?.access ?? {
    tier: "first_class" as const,
    isPreview: true,
    tierLabel: "1st Class",
    canAccessProgram: () => true,
    canAccessFeature: () => true,
  };
  const name = dashboard?.user.name ?? "Member";

  return (
    <MemberShell access={access} memberName={name}>
      {children}
    </MemberShell>
  );
}