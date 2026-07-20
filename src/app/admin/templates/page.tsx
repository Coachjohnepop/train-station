import { Suspense } from "react";
import AdminTemplateLibrary from "@/components/AdminTemplateLibrary";

export const dynamic = "force-dynamic";

export default function AdminTemplatesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Templates</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Day, week, and month packs in one library. Newest first. Paste onto programs from the
          program calendar (Templates & paste).
        </p>
      </div>
      <Suspense
        fallback={
          <p className="text-sm text-[var(--muted)]">Loading template library…</p>
        }
      >
        <AdminTemplateLibrary />
      </Suspense>
    </div>
  );
}
