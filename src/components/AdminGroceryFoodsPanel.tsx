"use client";

import { useCallback, useEffect, useState } from "react";

type Food = {
  id: string;
  name: string;
  aliases: string;
  category: string;
  whyGood: string;
  whyAvoid: string;
  sortOrder: number;
  archivedAt: string | null;
};

const CATEGORIES = ["protein", "veg", "fruit", "fat", "dairy", "drink", "pantry"];

const emptyForm = {
  name: "",
  aliases: "",
  category: "protein",
  whyGood: "",
  whyAvoid: "",
};

export default function AdminGroceryFoodsPanel() {
  const [foods, setFoods] = useState<Food[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/grocery-foods", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setFoods(data.foods || []);
    else setMessage(data.error || "Could not load foods.");
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveNew(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/grocery-foods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Save failed.");
      return;
    }
    setForm(emptyForm);
    setMessage("Added.");
    await load();
  }

  async function saveEdit(food: Food) {
    const res = await fetch("/api/admin/grocery-foods", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(food),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Save failed.");
      return;
    }
    setEditing(null);
    setMessage("Saved.");
    await load();
  }

  async function archive(id: string) {
    await fetch("/api/admin/grocery-foods", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "archive" }),
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--muted)]">
        Members tap <strong>Trainstationize</strong> on their shopping list. Known names and
        aliases swap first; leftovers go through Grok against this table. Bacon and extra-fatty
        cuts stay off.
      </p>
      {message ? <p className="text-sm text-accent">{message}</p> : null}

      <form onSubmit={saveNew} className="card space-y-3 p-4">
        <p className="text-sm font-semibold">Add food</p>
        <input
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
          placeholder="Name (Chicken breast)"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
          placeholder="Aliases (comma separated)"
          value={form.aliases}
          onChange={(e) => setForm({ ...form, aliases: e.target.value })}
        />
        <select
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <textarea
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
          rows={2}
          placeholder="Why it’s on the list"
          value={form.whyGood}
          onChange={(e) => setForm({ ...form, whyGood: e.target.value })}
        />
        <textarea
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
          rows={2}
          placeholder="Why the usual grocery version is out"
          value={form.whyAvoid}
          onChange={(e) => setForm({ ...form, whyAvoid: e.target.value })}
        />
        <button type="submit" className="btn-primary px-4 py-2 text-sm">
          Add to Jeremy’s list
        </button>
      </form>

      {loading ? <p className="text-sm text-[var(--muted)]">Loading…</p> : null}

      <ul className="space-y-3">
        {foods.map((food) => {
          const open = editing === food.id;
          return (
            <li key={food.id} className="card space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{food.name}</p>
                  <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                    {food.category}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs font-semibold text-accent"
                    onClick={() => setEditing(open ? null : food.id)}
                  >
                    {open ? "Close" : "Edit"}
                  </button>
                  <button
                    type="button"
                    className="text-xs font-semibold text-[var(--danger)]"
                    onClick={() => void archive(food.id)}
                  >
                    Archive
                  </button>
                </div>
              </div>
              {open ? (
                <div className="space-y-2">
                  <input
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
                    value={food.name}
                    onChange={(e) =>
                      setFoods((rows) =>
                        rows.map((r) => (r.id === food.id ? { ...r, name: e.target.value } : r)),
                      )
                    }
                  />
                  <input
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
                    value={food.aliases}
                    onChange={(e) =>
                      setFoods((rows) =>
                        rows.map((r) => (r.id === food.id ? { ...r, aliases: e.target.value } : r)),
                      )
                    }
                  />
                  <textarea
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
                    rows={2}
                    value={food.whyGood}
                    onChange={(e) =>
                      setFoods((rows) =>
                        rows.map((r) => (r.id === food.id ? { ...r, whyGood: e.target.value } : r)),
                      )
                    }
                  />
                  <textarea
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
                    rows={2}
                    value={food.whyAvoid}
                    onChange={(e) =>
                      setFoods((rows) =>
                        rows.map((r) => (r.id === food.id ? { ...r, whyAvoid: e.target.value } : r)),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="btn-primary px-4 py-2 text-sm"
                    onClick={() => void saveEdit(food)}
                  >
                    Save
                  </button>
                </div>
              ) : (
                <>
                  {food.aliases ? (
                    <p className="text-xs text-[var(--muted)]">Aliases: {food.aliases}</p>
                  ) : null}
                  <p className="text-sm">{food.whyGood}</p>
                  <p className="text-xs text-[var(--muted)]">{food.whyAvoid}</p>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
