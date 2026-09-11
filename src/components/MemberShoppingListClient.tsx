"use client";

import { useCallback, useEffect, useState } from "react";
import { useScreenWakeLock } from "@/hooks/useScreenWakeLock";
import { GROCERY_CLEANSE_NOTE } from "@/lib/approved-grocery-seed";

type Item = {
  id: string;
  label: string;
  originalLabel: string;
  checked: boolean;
  swapNote: string | null;
  trainstationized: boolean;
  approvedFoodId: string | null;
};

type ListPayload = { items: Item[] };

export default function MemberShoppingListClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [note, setNote] = useState(GROCERY_CLEANSE_NOTE);
  const [draft, setDraft] = useState("");
  const [openWhy, setOpenWhy] = useState<string | null>(null);
  const [fading, setFading] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"load" | "add" | "swap" | null>("load");
  const [error, setError] = useState<string | null>(null);

  useScreenWakeLock(items.some((i) => !i.checked));

  const applyList = useCallback((list: ListPayload) => {
    setItems(list.items);
  }, []);

  const load = useCallback(async () => {
    setBusy("load");
    setError(null);
    try {
      const res = await fetch("/api/member/shopping-list", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load list.");
      applyList(data.list);
      if (typeof data.note === "string") setNote(data.note);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load list.");
    } finally {
      setBusy((b) => (b === "load" ? null : b));
    }
  }, [applyList]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addFromText(text: string) {
    const next = text.trim();
    if (!next || busy === "add") return;
    setBusy("add");
    setError(null);
    try {
      const res = await fetch("/api/member/shopping-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add.");
      applyList(data.list);
      setDraft("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not add.");
    } finally {
      setBusy(null);
    }
  }

  function addItems(e: React.FormEvent) {
    e.preventDefault();
    void addFromText(draft);
  }

  function onDraftPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text");
    if (!/[\n,;]/.test(pasted)) return;
    e.preventDefault();
    void addFromText(pasted);
  }

  async function toggle(item: Item) {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i)),
    );
    const res = await fetch("/api/member/shopping-list", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id, checked: !item.checked }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.list) applyList(data.list);
  }

  async function remove(itemId: string) {
    const res = await fetch(`/api/member/shopping-list?itemId=${encodeURIComponent(itemId)}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.list) applyList(data.list);
  }

  async function clearChecked() {
    const res = await fetch("/api/member/shopping-list", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clearChecked: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.list) applyList(data.list);
  }

  async function trainstationize() {
    setBusy("swap");
    setError(null);
    const ids = new Set(items.filter((i) => !i.checked).map((i) => i.id));
    setFading(ids);
    await new Promise((r) => window.setTimeout(r, 280));
    try {
      const res = await fetch("/api/member/shopping-list/trainstationize", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Trainstationize failed.");
      applyList(data.list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Trainstationize failed.");
    } finally {
      window.setTimeout(() => setFading(new Set()), 40);
      setBusy(null);
    }
  }

  const remaining = items.filter((i) => !i.checked).length;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <p className="text-sm leading-relaxed text-[var(--muted)]">{note}</p>

      <form onSubmit={addItems} className="space-y-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onPaste={onDraftPaste}
          enterKeyHint="done"
          autoComplete="off"
          autoCapitalize="sentences"
          placeholder="Item name — Enter adds it, or paste a list"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-primary px-4 py-2 text-sm" disabled={busy === "add"}>
            {busy === "add" ? "Adding…" : "Add to list"}
          </button>
          <button
            type="button"
            className="btn-ghost rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold"
            onClick={() => void trainstationize()}
            disabled={busy === "swap" || remaining === 0}
          >
            {busy === "swap" ? "Trainstationizing…" : "Trainstationize"}
          </button>
        </div>
      </form>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      {items.length === 0 && busy !== "load" ? (
        <p className="text-sm text-[var(--muted)]">
          Empty list. Type or paste groceries, then Trainstationize before you shop.
        </p>
      ) : (
        <div className="flex items-center justify-between text-xs text-[var(--muted)]">
          <span>
            {remaining} to get · {items.length - remaining} checked
          </span>
          {items.some((i) => i.checked) ? (
            <button type="button" className="font-semibold text-accent" onClick={() => void clearChecked()}>
              Clear checked
            </button>
          ) : null}
        </div>
      )}

      <ul className="shop-check-grid">
        {items.map((item) => {
          const swapped = item.trainstationized && item.label !== item.originalLabel;
          const off = item.trainstationized && !item.approvedFoodId;
          return (
            <li
              key={item.id}
              className={`shop-check-cell ${item.checked ? "shop-check-cell--done" : ""} ${
                fading.has(item.id) ? "shop-check-cell--fade" : ""
              } ${off ? "shop-check-cell--off" : ""}`}
            >
              <button
                type="button"
                className="shop-check-box"
                aria-pressed={item.checked}
                aria-label={`${item.checked ? "Uncheck" : "Check"} ${item.label}`}
                onClick={() => void toggle(item)}
              >
                {item.checked ? "✓" : ""}
              </button>
              <button
                type="button"
                className="shop-check-label"
                onClick={() =>
                  setOpenWhy((id) => (id === item.id ? null : item.swapNote ? item.id : id))
                }
              >
                <span className="shop-check-name">{item.label}</span>
                {swapped ? (
                  <span className="shop-check-from">was {item.originalLabel}</span>
                ) : null}
              </button>
              <button
                type="button"
                className="shop-check-x"
                aria-label={`Remove ${item.label}`}
                onClick={() => void remove(item.id)}
              >
                ×
              </button>
              {openWhy === item.id && item.swapNote ? (
                <p className="shop-check-why">{item.swapNote}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
