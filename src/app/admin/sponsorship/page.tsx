import Link from "next/link";
import SponsorshipEcoDelight from "@/components/SponsorshipEcoDelight";
import { fetchEcoDelightSponsorStats } from "@/lib/sponsorship";

export const dynamic = "force-dynamic";

export default async function AdminSponsorshipPage() {
  const stats = await fetchEcoDelightSponsorStats();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/admin/day" className="text-xs text-accent hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Sponsorships</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Eco Delight affiliate for <strong>jeremy@thetrainstation.co</strong> — code{" "}
          <code className="rounded bg-[var(--surface-2)] px-1">JEREMYDISC</code> (10% · 100 uses ·
          12 months). Commission lands here when members buy through the Train Station link.
        </p>
      </div>

      <SponsorshipEcoDelight stats={stats} showCommission />

      <div className="card space-y-2 p-4 text-xs text-[var(--muted)]">
        <p className="font-semibold text-[var(--text)]">Ops checklist</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Eco Delight: run{" "}
            <code className="rounded bg-[var(--surface-2)] px-1">
              node scripts/seed-jeremy-trainstation-affiliate.mjs
            </code>
          </li>
          <li>Jeremy completes Stripe Connect in the Eco affiliate portal (payouts)</li>
          <li>
            Optional: set <code className="rounded bg-[var(--surface-2)] px-1">ECO_DELIGHT_API_URL</code>{" "}
            +{" "}
            <code className="rounded bg-[var(--surface-2)] px-1">
              ECO_DELIGHT_AFFILIATE_STATS_SECRET
            </code>{" "}
            on Vercel for live commission numbers
          </li>
          <li>
            Optional YouTube Short:{" "}
            <code className="rounded bg-[var(--surface-2)] px-1">
              NEXT_PUBLIC_JEREMY_YT_SHORT_ID
            </code>{" "}
            on Eco Delight
          </li>
        </ol>
      </div>
    </div>
  );
}
