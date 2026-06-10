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

export default function MemberHomeEquipment() {
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false); // default collapsed per client feedback for cleaner dashboard

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
    try {
      const res = await fetch("/api/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipment: updated }),
      });
      if (res.ok) {
        const json = await res.json();
        setItems(json.equipment || updated);
        setMessage("Saved!");
        setTimeout(() => setMessage(null), 1500);
      } else {
        setMessage("Failed to save");
      }
    } catch {
      setMessage("Failed to save");
    }
    setSaving(false);
  }

  function toggle(id: string) {
    const updated = items.map((item) =>
      item.id === id ? { ...item, hasAtHome: !item.hasAtHome } : item
    );
    setItems(updated);
    // Auto-save on toggle for nice UX
    save(updated);
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
        className="font-semibold text-sm mb-1 flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>
          Your Home Equipment
          {hasItems && (
            <span className="ml-1 text-[var(--muted)] font-normal">
              ({selectedCount}/{items.length} selected)
            </span>
          )}
        </span>
        <span className="text-[var(--muted)]">{isOpen ? "−" : "+"}</span>
        {message && <span className="text-[var(--success)] ml-2 text-[10px]">{message}</span>}
      </div>

      {isOpen && (
        <>
          {!hasItems ? (
            <div className="text-[var(--muted)]">No equipment catalog loaded.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-1">
              {items.map((item) => (
                <label key={item.id} className="flex items-center gap-2 cursor-pointer hover:bg-[var(--surface)]/50 px-1 py-0.5 rounded">
                  <input
                    type="checkbox"
                    checked={item.hasAtHome}
                    onChange={() => toggle(item.id)}
                    disabled={saving}
                    className="accent-accent"
                  />
                  <span className={item.hasAtHome ? "font-medium" : "text-[var(--muted)]"}>
                    {item.name}
                    {item.category && <span className="text-[9px] ml-1 opacity-60">({item.category})</span>}
                  </span>
                  {item.notes && <span className="text-[9px] text-[var(--muted)] ml-1">— {item.notes}</span>}
                </label>
              ))}
            </div>
          )}

          <div className="mt-2 text-[10px] text-[var(--muted)]">
            Check the items you have available at home. This helps show realistic “Home” workout options in hybrid programs like Adult.
          </div>
        </>
      )}
    </div>
  );
}
