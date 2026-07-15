import MemberEquipmentShop from "@/components/MemberEquipmentShop";

export default function MemberEquipmentPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Gear</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Coach-recommended equipment. Tap a photo to open the store in a{" "}
          <strong>new tab</strong> — this app stays open here.
        </p>
      </div>
      <MemberEquipmentShop />
    </div>
  );
}
