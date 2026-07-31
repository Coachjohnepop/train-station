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
            Everyone who pre-signed up from the landing page. Click{" "}
            <strong className="font-medium text-[var(--text)]">Date</strong> to
            sort newest ↔ oldest.
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-center">
          <div className="text-2xl font-semibold text-accent">{leads.length}</div>
          <div className="text-[10px] uppercase tracking-[2px] text-[var(--muted)]">
            Total leads
          </div>
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-2 py-16 text-center">
          <p className="text-sm font-medium">No leads yet.</p>
          <p className="text-xs text-[var(--muted)]">
            New pre-sign-ups from the landing page will appear here.
          </p>
        </div>
      ) : (
        <AdminLeadsTable leads={leads} />
      )}
    </div>
  );
}
