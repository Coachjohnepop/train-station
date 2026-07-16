import AdminEquipmentCatalog from "@/components/AdminEquipmentCatalog";

export default function AdminEquipmentPage() {
  return (
    <div className="w-full max-w-none space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Equipment</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
          Paste product links (Amazon, etc.) to pull a photo and title for members on{" "}
          <strong>Gear</strong> — they open the store in a new tab. Catalog uses{" "}
          <strong>1 column on phones</strong>, <strong>2 on tablets</strong>,{" "}
          <strong>3 on wide desktops</strong>.
        </p>
      </div>
      <AdminEquipmentCatalog />
    </div>
  );
}
