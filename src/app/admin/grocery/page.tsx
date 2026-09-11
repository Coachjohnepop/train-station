import AdminGroceryFoodsPanel from "@/components/AdminGroceryFoodsPanel";

export const dynamic = "force-dynamic";

export default function AdminGroceryPage() {
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Grocery list</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Jeremy’s cleanse foods. Members paste a store list and tap Trainstationize — each item
          fades and comes back as one of these, with why it’s in and why the usual version is out.
        </p>
      </div>
      <AdminGroceryFoodsPanel />
    </div>
  );
}
