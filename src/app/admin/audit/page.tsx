import AdminAuditClient from "@/app/admin/audit/AdminAuditClient";

export const dynamic = "force-dynamic";

export default function AdminAuditPage() {
  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Audit log</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Append-only diligence trail — mark-paid, refunds, discounts, tips, role changes, SMS, and
          more. Platform staff only.
        </p>
      </div>
      <AdminAuditClient />
    </div>
  );
}
