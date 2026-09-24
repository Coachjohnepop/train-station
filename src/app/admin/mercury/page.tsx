import { redirect } from "next/navigation";
import AdminMercuryClient from "@/components/AdminMercuryClient";
import { getSessionUser } from "@/lib/auth";
import { defaultCoachAdminPath } from "@/lib/admin-nav-sections";
import { canAccessPlatformAdmin } from "@/lib/staff-access";

export const dynamic = "force-dynamic";

export default async function AdminMercuryPage() {
  const session = await getSessionUser();
  if (!session || !canAccessPlatformAdmin(session.role)) {
    redirect(defaultCoachAdminPath());
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          <a href="https://app.mercury.com/dashboard" target="_blank" rel="noopener noreferrer" className="hover:underline">
            Mercury
          </a>
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          The Train Station bank at Mercury. Balances, registers, in-flight items, statements, cards, and recipients, read live.
          The last 90 days of transactions. Sending money stays in Mercury.
        </p>
      </div>
      <AdminMercuryClient />
    </div>
  );
}
