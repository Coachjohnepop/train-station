import AdminEquipmentCatalog from "@/components/AdminEquipmentCatalog";

export default function AdminEquipmentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Equipment catalog</h1>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">
          Manage the open equipment list coaches and members use for home-workout matching. Add,
          edit, or remove items here — they appear as checkboxes for every member.
        </p>
      </div>
      <AdminEquipmentCatalog />
    </div>
  );
}