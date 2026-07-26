import Link from "next/link";
import SponsorshipEcoDelight from "@/components/SponsorshipEcoDelight";
import { fetchEcoDelightSponsorStats } from "@/lib/sponsorship";
import { getSessionUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/staff-access";

export const dynamic = "force-dynamic";

export default async function MemberSponsorshipPage() {
  const session = await getSessionUser();
  const stats = await fetchEcoDelightSponsorStats();
  const showCommission = Boolean(session && isStaffRole(session.role));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/member/today" className="text-xs text-accent hover:underline">
          ← Today
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Sponsorships</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Partners that support The Train Station — discounts for members, commission for the
          house when you shop through our links.
        </p>
      </div>

      <SponsorshipEcoDelight stats={stats} showCommission={showCommission} />

      {!showCommission ? (
        <p className="text-[11px] text-[var(--muted)]">
          Member view: use the Buy now link and code for your discount. Coach commission totals
          appear on the admin sponsorship board.
        </p>
      ) : null}
    </div>
  );
}
