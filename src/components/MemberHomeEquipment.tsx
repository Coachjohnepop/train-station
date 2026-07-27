"use client";

import { useEffect, useState } from "react";

type EquipmentItem = {
  id: string;
  name: string;
  category?: string;
  hasAtHome: boolean;
  quantity?: number;
  notes?: string;
};

export default function MemberHomeEquipment({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/equipment");
      const json = await res.json();
      setItems(json.equipment || []);
    } catch (e) {
      setMessage("Failed to load equipment list");
    }
    setLoading(false);
  }

  async function save(updated: EquipmentItem[]) {
    setSaving(true);
    setMessage(null);
    const payload = updated.map((item) => ({
      equipmentId: item.id,
      hasAtHome: item.hasAtHome,
      quantity: item.quantity ?? 1,
      notes: item.notes,
    }));
    try {
      const res = await fetch("/api/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipment: payload }),
      });
      if (res.ok) {
        const json = await res.json();
        setItems(json.equipment || updated);
        setMessage("Saved!");
        setTimeout(() => setMessage(null), 1500);
      } else {
        setMessage("Failed to save");
        await load();
      }
    } catch {
      setMessage("Failed to save");
      await load();
    }
    setSaving(false);
  }

  function toggle(id: string) {
    const updated = items.map((item) =>
      item.id === id ? { ...item, hasAtHome: !item.hasAtHome } : item
    );
    setItems(updated);
    void save(updated);
  }

  function setAll(hasAtHome: boolean) {
    const updated = items.map((item) => ({ ...item, hasAtHome }));
    setItems(updated);
    void save(updated);
  }

  async function addCustomItem() {
    const name = newName.trim();
    if (!name) {
      setMessage("Enter a name for your item");
      return;
    }
    setAdding(true);
    setMessage(null);
    try {
      const res = await fetch("/api/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category: "custom" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(json.error || "Could not add item");
        return;
      }
      setItems(json.equipment || []);
      setNewName("");
      setShowAdd(false);
      setMessage("Added!");
      setTimeout(() => setMessage(null), 1500);
    } catch {
      setMessage("Could not add item");
    } finally {
      setAdding(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const selectedCount = items.filter((i) => i.hasAtHome).length;

  if (loading) {
    return <div className="card text-xs p-3 bg-[var(--surface-2)]">Loading your home equipment...</div>;
  }

  const hasItems = items.length > 0;

  return (
    <div className="card text-xs p-3 bg-[var(--surface-2)]">
      <div
        className="font-semibold text-sm mb-1 flex items-center gap-2 cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={`text-xs text-accent transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>
        <span className="flex-1">
          Your Home Equipment
          {hasItems && (
            <span className="ml-1 text-[var(--muted)] font-normal">
              ({selectedCount}/{items.length} selected)
            </span>
          )}
        </span>
        {message && <span className="text-[var(--success)] text-[10px]">{message}</span>}
      </div>

      {isOpen && (
        <>
          {!hasItems ? (
            <div className="text-[var(--muted)]">No equipment catalog loaded.</div>
          ) : (
            <>
            <div className="mt-1 flex items-center gap-3 text-[11px]">
              <button
                type="button"
                onClick={() => setAll(true)}
                disabled={saving || selectedCount === items.length}
                className="font-medium text-accent hover:underline disabled:cursor-default disabled:text-[var(--muted)] disabled:no-underline"
              >
                Select all
              </button>
              {selectedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setAll(false)}
                  disabled={saving}
                  className="text-[var(--muted)] hover:text-white hover:underline disabled:opacity-50"
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-1">
              {items.map((item) => (
                <label key={item.id} className="flex items-start gap-2 cursor-pointer hover:bg-[var(--surface)]/50 px-1 py-1 rounded">
                  <input
                    type="checkbox"
                    checked={item.hasAtHome}
                    onChange={() => toggle(item.id)}
                    disabled={saving}
                    className="mt-0.5 accent-accent"
                  />
                  <span className={item.hasAtHome ? "font-medium" : "text-[var(--muted)]"}>
                    {item.name}
                    {item.category && item.category !== "custom" ? (
                      <span className="text-[9px] ml-1 opacity-60">({item.category})</span>
                    ) : null}
                    {item.category === "custom" ? (
                      <span className="text-[9px] ml-1 text-accent/80">custom</span>
                    ) : null}
                    {item.notes ? (
                      <span className="block text-[9px] text-[var(--muted)] font-normal">
                        — {item.notes}
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>

            {!showAdd ? (
              <button
                type="button"
                className="mt-2 text-[11px] font-semibold text-accent hover:underline"
                onClick={() => setShowAdd(true)}
              >
                + Add item not listed
              </button>
            ) : (
              <div className="mt-2 flex flex-col gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2">
                <p className="text-[10px] font-medium text-[var(--text)]">Add your own equipment</p>
                <input
                  className="input w-full text-xs"
                  placeholder="e.g. TRX straps, sandbag, bike…"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void addCustomItem();
                    }
                  }}
                  disabled={adding}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-primary flex-1 text-[11px] py-1.5"
                    disabled={adding || !newName.trim()}
                    onClick={() => void addCustomItem()}
                  >
                    {adding ? "Adding…" : "Add item"}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost text-[11px] py-1.5"
                    disabled={adding}
                    onClick={() => {
                      setShowAdd(false);
                      setNewName("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            </>
          )}

          <div className="mt-2 text-[10px] text-[var(--muted)]">
            Check what you have at home (aim for ~10 common options + anything you add). This helps
            show realistic “Home” workout options in hybrid programs like Adult.
          </div>
        </>
      )}
    </div>
  );
}
