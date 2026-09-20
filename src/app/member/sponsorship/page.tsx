import Link from "next/link";
import SponsorshipCoffeeCrew from "@/components/SponsorshipCoffeeCrew";

export const dynamic = "force-dynamic";

export default function MemberSponsorshipPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/member/today" className="text-xs text-accent hover:underline">
          ← Today
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Sponsorships</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Partners that support The Train Station.
        </p>
      </div>

      <SponsorshipCoffeeCrew />
    </div>
  );
}
