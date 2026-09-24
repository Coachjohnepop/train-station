import { redirect } from "next/navigation";
import AdminAffiliateOps from "@/components/AdminAffiliateOps";
import AdminAffiliatesClient from "@/components/AdminAffiliatesClient";
import { getSessionUser } from "@/lib/auth";
import { defaultCoachAdminPath } from "@/lib/admin-nav-sections";
import { canAccessPlatformAdmin } from "@/lib/staff-access";

export const dynamic = "force-dynamic";

export default async function AdminAffiliatesPage() {
  const session = await getSessionUser();
  if (!session || !canAccessPlatformAdmin(session.role)) {
    redirect(defaultCoachAdminPath());
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Affiliates</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          The Train Station affiliate users, the percent they earn on a paid membership, and Stripe payouts.
          The public site does not link to their sign-in page.
        </p>
      </div>
      <AdminAffiliateOps />
      <AdminAffiliatesClient />
    </div>
  );
}
