import { Suspense } from "react";
import AdminSeoClient from "@/components/AdminSeoClient";

export const dynamic = "force-dynamic";

export default function AdminSeoPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading SEO…</p>}>
      <AdminSeoClient />
    </Suspense>
  );
}
