"use client";

import { useEffect, useState } from "react";

type Approach = {
  id: string;
  slug: string | null;
  label: string;
  description: string;
  sortOrder: number;
};

export default function AdminApproachesPanel() {
  const [rows, setRows] = useState<Approach[]>([]);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/approaches", { cache: "no-store" });
    if (!res.ok) {
      setError("Could not load approaches.");
      return;
    }
    const data = (await res.json()) as { approaches: Approach[] };
    setRows(data.approaches);
  }

  useEffect(() => {
    void load();
  }, []);

  async function add() {
    setError(null);
    setMessage(null);
    const res = await fetch("/api/admin/approaches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, description }),
    });
    if (!res.ok) {
      setError("Add a label and the line members should read.");
      return;
    }
    setLabel("");
    setDescription("");
    setMessage("Added.");
    await load();
  }

  async function save(row: Approach) {
    setError(null);
    const res = await fetch(`/api/admin/approaches/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: row.label, description: row.description }),
    });
    if (!res.ok) {
      setError("Could not save that approach.");
      return;
    }
    setMessage("Saved.");
  }

  async function remove(row: Approach) {
    if (!confirm(`Remove “${row.label}”?`)) return;
    const res = await fetch(`/api/admin/approaches/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Could not remove that approach.");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-3">
        <p className="text-sm font-semibold">Add an approach</p>
        <label className="block text-sm">
          <span className="font-medium">Name</span>
          <input
            className="input mt-1"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="2 and 7"
            maxLength={80}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">What members see</span>
          <input
            className="input mt-1"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Hold 2 count at bottom, 7 count up"
            maxLength={200}
          />
        </label>
        <button type="button" className="btn-primary" onClick={() => void add()}>
          Add approach
        </button>
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {message ? <p className="text-sm text-[var(--success)]">{message}</p> : null}

      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="card space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                {row.slug ? `Default for ${row.slug.replaceAll("_", " ")}` : "Custom"}
              </p>
              <button type="button" className="text-sm text-[var(--danger)]" onClick={() => void remove(row)}>
                Remove
              </button>
            </div>
            <input
              className="input"
              value={row.label}
              aria-label="Approach name"
              onChange={(e) =>
                setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, label: e.target.value } : item)))
              }
            />
            <input
              className="input"
              value={row.description}
              aria-label="What members see"
              onChange={(e) =>
                setRows((prev) =>
                  prev.map((item) => (item.id === row.id ? { ...item, description: e.target.value } : item)),
                )
              }
            />
            <button type="button" className="btn-ghost text-sm" onClick={() => void save(row)}>
              Save
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
