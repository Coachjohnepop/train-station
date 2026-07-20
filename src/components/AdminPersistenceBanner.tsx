"use client";

import { useEffect, useState } from "react";

type PersistenceStatus = {
  demoMode?: boolean;
  durable?: boolean;
  message?: string;
};

export default function AdminPersistenceBanner() {
  const [status, setStatus] = useState<PersistenceStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/demo-persistence", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setStatus(data as PersistenceStatus);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status?.message) return null;

  const isDatabase = !status.demoMode;
  const isWarning = status.demoMode && !status.durable;

  return (
    <div
      data-admin-persistence-banner
      className={`mb-4 rounded-xl border px-4 py-2.5 text-sm ${
        isWarning
          ? "border-amber-500/50 bg-amber-950/30 text-amber-100"
          : isDatabase
            ? "border-emerald-500/35 bg-emerald-950/25 text-emerald-100"
            : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]"
      }`}
      role="status"
    >
      <p className="font-medium">
        {isDatabase ? "Production database" : isWarning ? "Save warning" : "Demo storage"}
      </p>
      <p className="mt-0.5 text-xs opacity-90">{status.message}</p>
    </div>
  );
}