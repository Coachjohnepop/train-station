import { Suspense } from "react";
import AdminSocialDripClient from "@/components/AdminSocialDripClient";

export const dynamic = "force-dynamic";

export default function AdminSocialPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading social…</p>}>
      <AdminSocialDripClient />
    </Suspense>
  );
}
