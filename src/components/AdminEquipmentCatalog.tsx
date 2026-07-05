"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { formatApiError } from "@/lib/api-errors";

type EquipmentItem = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
};

const CATEGORY_SUGGESTIONS = [
  "bodyweight",
  "dumbbells",
  "bands",
  "bench",
  "barbell",
  "pullup",
  "kettlebell",
  "machine",
  "accessory",
];

export default function AdminEquipmentCatalog() {
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/equipment");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not load equipment catalog.");
      setItems([]);
    } else {
      setItems(data.equipment || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createItem(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError("");
    const res = await fetch("/api/admin/equipment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        category: newCategory.trim() || null,
        description: newDescription.trim() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setCreating(false);
    if (!res.ok) {
      setError(data.error || formatApiError(data.detail) || "Could not add equipment.");
      return;
    }
    setItems((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewName("");
    setNewCategory("");
    setNewDescription("");
  }

  async function saveItem(item: EquipmentItem) {
    setSavingId(item.id);
    setError("");
    const res = await fetch(`/api/admin/equipment/${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: item.name,
        category: item.category,
        description: item.description,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingId(null);
    if (!res.ok) {
      setError(data.error || formatApiError(data.detail) || "Could not save equipment.");
      await load();
      return;
    }
    setItems((prev) =>
      prev
        .map((row) => (row.id === item.id ? data : row))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  async function removeItem(id: string, name: string) {
    if (!window.confirm(`Remove "${name}" from the equipment catalog?`)) return;
    setDeletingId(id);
    setError("");
    const res = await fetch(`/api/admin/equipment/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    setDeletingId(null);
    if (!res.ok) {
      setError(data.error || "Could not delete equipment.");
      return;
    }
    setItems((prev) => prev.filter((row) => row.id !== id));
  }

  function updateDraft(id: string, patch: Partial<EquipmentItem>) {
    setItems((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Loading equipment catalog…</p>;
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-amber-400">{error}</p>}

      <form onSubmit={createItem} className="card space-y-3 p-4">
        <h2 className="text-sm font-semibold">Add equipment</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="eq-name" className="text-xs font-medium text-[var(--muted)]">
              Name
            </label>
            <input
              id="eq-name"
              className="input mt-1 w-full"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Leg press machine"
              required
            />
          </div>
          <div>
            <label htmlFor="eq-category" className="text-xs font-medium text-[var(--muted)]">
              Category
            </label>
            <input
              id="eq-category"
              className="input mt-1 w-full"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="machine"
              list="eq-category-suggestions"
            />
            <datalist id="eq-category-suggestions">
              {CATEGORY_SUGGESTIONS.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>
          <div>
            <label htmlFor="eq-description" className="text-xs font-medium text-[var(--muted)]">
              Notes (optional)
            </label>
            <input
              id="eq-description"
              className="input mt-1 w-full"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="e.g. Home gym model"
            />
          </div>
        </div>
        <button type="submit" className="btn-primary text-sm" disabled={creating || !newName.trim()}>
          {creating ? "Adding…" : "Add to catalog"}
        </button>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-[2px] text-[var(--muted)]">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Notes</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[var(--muted)]">
                  No equipment in catalog yet.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]"
                >
                  <td className="px-4 py-3">
                    <input
                      className="input w-full min-w-[10rem] py-1.5 text-sm"
                      value={item.name}
                      onChange={(e) => updateDraft(item.id, { name: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      className="input w-full min-w-[7rem] py-1.5 text-sm"
                      value={item.category ?? ""}
                      onChange={(e) => updateDraft(item.id, { category: e.target.value || null })}
                      list="eq-category-suggestions"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      className="input w-full min-w-[12rem] py-1.5 text-sm"
                      value={item.description ?? ""}
                      onChange={(e) =>
                        updateDraft(item.id, { description: e.target.value || null })
                      }
                    />
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      className="btn-ghost text-xs px-3 py-1.5"
                      disabled={savingId === item.id}
                      onClick={() => void saveItem(item)}
                    >
                      {savingId === item.id ? "…" : "Save"}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost text-xs px-3 py-1.5 text-rose-300"
                      disabled={deletingId === item.id}
                      onClick={() => void removeItem(item.id, item.name)}
                    >
                      {deletingId === item.id ? "…" : "Remove"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}