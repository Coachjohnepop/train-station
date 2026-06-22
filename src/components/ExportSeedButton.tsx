"use client";

import { useState } from "react";

export default function ExportSeedButton({ className = "" }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleExport() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/export-seed", { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage(err.error || `Export failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const stamp = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `seed-data-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage("Downloaded — review, rename to seed-data.json, commit.");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleExport}
        disabled={busy}
        className="btn-ghost text-sm ring-1 ring-accent/30"
      >
        {busy ? "Exporting…" : "Export seed snapshot"}
      </button>
      {message && <p className="mt-1 text-[10px] text-[var(--muted)]">{message}</p>}
    </div>
  );
}