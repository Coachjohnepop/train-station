import Link from "next/link";
import MemberShoppingListClient from "@/components/MemberShoppingListClient";

export const dynamic = "force-dynamic";

export default function MemberShoppingListPage() {
  return (
    <div className="space-y-4">
      <div>
        <Link href="/member/nutrition" className="text-xs font-semibold text-[var(--accent)] hover:underline">
          ← Nutrition
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Shopping list</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Check items off as you walk the store. Trainstationize maps your list onto Jeremy’s
          cleanse foods — tap a swapped name to see why.
        </p>
      </div>
      <MemberShoppingListClient />
    </div>
  );
}
