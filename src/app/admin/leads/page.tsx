import { listLeads } from "@/lib/waitlist";
import LeadsSeenMarker from "@/components/LeadsSeenMarker";
import AdminLeadsTable from "@/components/AdminLeadsTable";

export const dynamic = "force-dynamic";

export default async function AdminLeadsPage() {
  const leads = await listLeads();

  return (
    <div className="space-y-6">
      <LeadsSeenMarker />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-[var(--muted)]">
            Everyone who pre-signed up from the landing page. Use{" "}
            <strong className="font-medium text-[var(--text)]">Drip Campaign</strong>,{" "}
            <strong className="font-medium text-[var(--text)]">Convert and send join link</strong>,
            or <strong className="font-medium text-[var(--text)]">Archive</strong> to sort the
            list. Click{" "}
            <strong className="font-medium text-[var(--text)]">Date</strong> to sort newest ↔
            oldest.
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-center">
          <div className="text-2xl font-semibold text-accent">{leads.length}</div>
          <div className="text-[10px] uppercase tracking-[2px] text-[var(--muted)]">
            Total leads
          </div>
        </div>
      </div>

      <AdminLeadsTable leads={leads} />
    </div>
  );
}
