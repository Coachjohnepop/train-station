"use client";

import { useCallback, useEffect, useState } from "react";

type EquipmentItem = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  hasAtHome: boolean;
  quantity: number;
  notes: string;
};

type Props = {
  userId: string;
  memberName: string;
  onClose: () => void;
};

export default function AdminMemberEquipmentModal({ userId, memberName, onClose }: Props) {
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/admin/members/${encodeURIComponent(userId)}/equipment`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not load member equipment.");
      setItems([]);
    } else {
      setItems(data.equipment || []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(updated: EquipmentItem[]) {
    setSaving(true);
    setMessage(null);
    setError("");
    const payload = updated.map((item) => ({
      equipmentId: item.id,
      hasAtHome: item.hasAtHome,
      quantity: item.quantity ?? 1,
      notes: item.notes || undefined,
    }));
    const res = await fetch(`/api/admin/members/${encodeURIComponent(userId)}/equipment`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ equipment: payload }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Failed to save equipment.");
      await load();
      return;
    }
    setItems(data.equipment || updated);
    setMessage("Saved");
    setTimeout(() => setMessage(null), 1500);
  }

  function toggle(id: string) {
    const updated = items.map((item) =>
      item.id === id ? { ...item, hasAtHome: !item.hasAtHome } : item,
    );
    setItems(updated);
    void save(updated);
  }

  function setNotes(id: string, notes: string) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, notes } : item)));
  }

  function saveNotes(id: string) {
    void save(items);
  }

  function setAll(hasAtHome: boolean) {
    const updated = items.map((item) => ({ ...item, hasAtHome }));
    setItems(updated);
    void save(updated);
  }

  const selectedCount = items.filter((item) => item.hasAtHome).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden p-0">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Home equipment</h2>
            <p className="text-sm text-[var(--muted)]">{memberName}</p>
          </div>
          <button type="button" className="btn-ghost text-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-[var(--muted)]">Loading equipment…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No equipment catalog yet. Add items in{" "}
              <a href="/admin/equipment" className="text-accent hover:underline">
                Admin → Equipment
              </a>
              .
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="text-[var(--muted)]">
                  {selectedCount}/{items.length} selected
                </span>
                {message && <span className="text-emerald-300">{message}</span>}
                {error && <span className="text-amber-400">{error}</span>}
                <button
                  type="button"
                  onClick={() => setAll(true)}
                  disabled={saving || selectedCount === items.length}
                  className="font-medium text-accent hover:underline disabled:opacity-50"
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

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2"
                  >
                    <label className="flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        checked={item.hasAtHome}
                        onChange={() => toggle(item.id)}
                        disabled={saving}
                        className="mt-0.5 accent-accent"
                      />
                      <span className="min-w-0 flex-1">
                        <span className={item.hasAtHome ? "font-medium" : "text-[var(--muted)]"}>
                          {item.name}
                        </span>
                        {item.category && (
                          <span className="ml-1 text-[10px] text-[var(--muted)]">
                            ({item.category})
                          </span>
                        )}
                      </span>
                    </label>
                    {item.hasAtHome && (
                      <input
                        className="input mt-2 w-full py-1 text-xs"
                        placeholder="Notes (optional)"
                        value={item.notes}
                        onChange={(e) => setNotes(item.id, e.target.value)}
                        onBlur={() => saveNotes(item.id)}
                        disabled={saving}
                      />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-[var(--border)] px-5 py-3 text-[11px] text-[var(--muted)]">
          Check what this member has at home. New catalog items appear here automatically.
        </div>
      </div>
    </div>
  );
}