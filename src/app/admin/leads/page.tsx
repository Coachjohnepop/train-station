import { listWaitlist } from "@/lib/waitlist";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminLeadsPage() {
  const leads = listWaitlist();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-[var(--muted)]">
            Everyone who pre-signed up from the landing page.
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
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-[2px] text-[var(--muted)]">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Interest</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]"
                >
                  <td className="px-4 py-3 font-medium">{lead.name || "Guest"}</td>
                  <td className="px-4 py-3">
                    <a
                      href={`mailto:${lead.email}`}
                      className="text-accent hover:underline"
                    >
                      {lead.email}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {lead.plan || "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {lead.source || "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {formatDate(lead.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
