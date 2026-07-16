import AdminEquipmentCatalog from "@/components/AdminEquipmentCatalog";

export default function AdminEquipmentPage() {
  return (
    /* Break out of admin max-w-6xl so 2–3 catalog columns have room on laptop widths */
    <div className="w-full max-w-none space-y-6 xl:w-[min(100%,calc(100vw-14rem))]">
      <div>
        <h1 className="text-2xl font-bold">Equipment</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
          Paste product links (Amazon, etc.) to pull a photo and title for members on{" "}
          <strong>Gear</strong> — they open the store in a new tab. Catalog fills{" "}
          <strong>as many columns as fit</strong> (~1 phone · 2 tablet · 3 desktop).
        </p>
      </div>
      <AdminEquipmentCatalog />
    </div>
  );
}
