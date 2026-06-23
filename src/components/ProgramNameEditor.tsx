"use client";

import { useState } from "react";

export default function ProgramNameEditor({
  slug,
  initialName,
  onSaved,
}: {
  slug: string;
  initialName: string;
  onSaved?: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(nextName: string) {
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === name) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/programs/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { detail?: string } | null;
        setError(typeof body?.detail === "string" ? body.detail : "Could not save name");
        return;
      }
      const updated = await res.json();
      const saved = (updated.name as string) || trimmed;
      setName(saved);
      onSaved?.(saved);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-0">
      <input
        className="w-full max-w-xl border-0 bg-transparent p-0 text-xl font-semibold tracking-tight outline-none focus:ring-0 disabled:opacity-60"
        value={name}
        aria-label="Program name"
        disabled={saving}
        onChange={(e) => setName(e.target.value)}
        onBlur={(e) => void save(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      {error && <p className="text-[10px] text-[var(--danger)]">{error}</p>}
    </div>
  );
}