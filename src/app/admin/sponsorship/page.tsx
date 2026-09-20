import Link from "next/link";
import SponsorshipCoffeeCrew from "@/components/SponsorshipCoffeeCrew";

export const dynamic = "force-dynamic";

export default function AdminSponsorshipPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/admin/day" className="text-xs text-accent hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Sponsorships</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          The Coffee Crew is the live partner. Instagram only for now — shop codes later.
        </p>
      </div>

      <SponsorshipCoffeeCrew />
    </div>
  );
}
