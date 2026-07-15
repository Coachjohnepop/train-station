import AdminEquipmentCatalog from "@/components/AdminEquipmentCatalog";

export default function AdminEquipmentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Equipment</h1>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">
          Paste product links (Amazon, etc.) to pull a photo and title for members on{" "}
          <strong>Gear</strong> — they open the store in a new tab. The same catalog also powers
          home-workout equipment checkboxes.
        </p>
      </div>
      <AdminEquipmentCatalog />
    </div>
  );
}
