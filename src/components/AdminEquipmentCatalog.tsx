"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { formatApiError } from "@/lib/api-errors";

type EquipmentItem = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  productUrl: string | null;
  imageUrl: string | null;
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

function ProductThumb({
  name,
  imageUrl,
  productUrl,
}: {
  name: string;
  imageUrl: string | null;
  productUrl?: string | null;
}) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl || ""}
      alt={name}
      className="h-full w-full object-contain"
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );

  if (!imageUrl) {
    return (
      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[10px] text-[var(--muted)]">
        No photo
      </div>
    );
  }

  if (productUrl) {
    return (
      <a
        href={productUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-white"
        title="Open product (new tab)"
      >
        {img}
      </a>
    );
  }

  return (
    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-white">
      {img}
    </div>
  );
}

export default function AdminEquipmentCatalog() {
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const [pasteUrl, setPasteUrl] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newProductUrl, setNewProductUrl] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");

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

  async function previewFromLink() {
    const url = pasteUrl.trim();
    if (!url) {
      setError("Paste an Amazon (or other product) link first.");
      return;
    }
    setPreviewing(true);
    setError("");
    try {
      const res = await fetch("/api/admin/equipment/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not read that link.");
        return;
      }
      setNewProductUrl(data.url || url);
      if (data.title) setNewName(data.title);
      if (data.imageUrl) setNewImageUrl(data.imageUrl);
      if (data.description && !newDescription.trim()) {
        setNewDescription(String(data.description).slice(0, 500));
      }
      if (!newCategory.trim() && /amazon/i.test(url)) {
        setNewCategory("accessory");
      }
    } catch {
      setError("Could not read that link — check the URL and try again.");
    } finally {
      setPreviewing(false);
    }
  }

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
        productUrl: newProductUrl.trim() || pasteUrl.trim() || null,
        imageUrl: newImageUrl.trim() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setCreating(false);
    if (!res.ok) {
      setError(data.error || formatApiError(data.detail) || "Could not add equipment.");
      return;
    }
    setItems((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setPasteUrl("");
    setNewName("");
    setNewCategory("");
    setNewDescription("");
    setNewProductUrl("");
    setNewImageUrl("");
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
        productUrl: item.productUrl,
        imageUrl: item.imageUrl,
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

  async function refreshImageFromLink(item: EquipmentItem) {
    const url = item.productUrl?.trim();
    if (!url) {
      setError("Add a product link first, then refresh the photo.");
      return;
    }
    setSavingId(item.id);
    setError("");
    try {
      const res = await fetch("/api/admin/equipment/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not refresh photo from link.");
        setSavingId(null);
        return;
      }
      const next: EquipmentItem = {
        ...item,
        imageUrl: data.imageUrl || item.imageUrl,
        name: item.name.trim() || data.title || item.name,
      };
      await saveItem(next);
    } catch {
      setError("Could not refresh photo from link.");
      setSavingId(null);
    }
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

  const shopCount = items.filter((i) => i.productUrl).length;

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-amber-400">{error}</p>}

      <form onSubmit={createItem} className="card space-y-4 p-4">
        <div>
          <h2 className="text-sm font-semibold">Add from product link</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Paste an Amazon (or other store) link. We pull the title and a photo when the site
            allows. Members see the image on <strong>Gear</strong> and open the store in a{" "}
            <strong>new tab</strong> only.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="eq-paste" className="text-xs font-medium text-[var(--muted)]">
              Product link
            </label>
            <input
              id="eq-paste"
              className="input mt-1 w-full"
              value={pasteUrl}
              onChange={(e) => setPasteUrl(e.target.value)}
              placeholder="https://www.amazon.com/dp/…"
              inputMode="url"
            />
          </div>
          <button
            type="button"
            className="btn-ghost min-h-[44px] shrink-0 px-4 text-sm"
            disabled={previewing || !pasteUrl.trim()}
            onClick={() => void previewFromLink()}
          >
            {previewing ? "Reading link…" : "Get photo & title"}
          </button>
        </div>

        {(newImageUrl || newName || newProductUrl) && (
          <div className="flex flex-wrap items-start gap-3 rounded-lg border border-accent/25 bg-accent/5 p-3">
            <ProductThumb
              name={newName || "Preview"}
              imageUrl={newImageUrl || null}
              productUrl={newProductUrl || pasteUrl || null}
            />
            <div className="min-w-0 flex-1 text-xs text-[var(--muted)]">
              <p className="font-medium text-[var(--text)]">Preview</p>
              <p className="mt-1 break-words">{newName || "—"}</p>
              {(newProductUrl || pasteUrl) && (
                <p className="mt-1 truncate text-[10px] opacity-80">
                  {newProductUrl || pasteUrl}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="eq-name" className="text-xs font-medium text-[var(--muted)]">
              Name
            </label>
            <input
              id="eq-name"
              className="input mt-1 w-full"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Adjustable dumbbells"
              required
            />
          </div>
          <div>
            <label htmlFor="eq-cat" className="text-xs font-medium text-[var(--muted)]">
              Category
            </label>
            <input
              id="eq-cat"
              className="input mt-1 w-full"
              list="eq-cat-suggestions"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="dumbbells, bands…"
            />
            <datalist id="eq-cat-suggestions">
              {CATEGORY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label htmlFor="eq-img" className="text-xs font-medium text-[var(--muted)]">
              Image URL (optional override)
            </label>
            <input
              id="eq-img"
              className="input mt-1 w-full"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              placeholder="Auto-filled from link"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="eq-desc" className="text-xs font-medium text-[var(--muted)]">
              Notes for members (optional)
            </label>
            <textarea
              id="eq-desc"
              className="input mt-1 w-full min-h-[72px]"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Why you recommend this, size tips…"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-primary min-h-[44px] px-4 text-sm" disabled={creating}>
            {creating ? "Adding…" : "Add equipment"}
          </button>
        </div>
      </form>

      <div>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Catalog</h2>
          <p className="text-xs text-[var(--muted)]">
            {items.length} item{items.length === 1 ? "" : "s"}
            {shopCount > 0 ? ` · ${shopCount} with shop link` : ""}
          </p>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No equipment yet. Paste a product link above to add the first piece.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="card space-y-3 p-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <ProductThumb
                    name={item.name}
                    imageUrl={item.imageUrl}
                    productUrl={item.productUrl}
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      className="input w-full font-medium"
                      value={item.name}
                      onChange={(e) => updateDraft(item.id, { name: e.target.value })}
                      aria-label="Name"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        className="input w-full text-sm"
                        value={item.category || ""}
                        onChange={(e) =>
                          updateDraft(item.id, { category: e.target.value || null })
                        }
                        placeholder="Category"
                        list="eq-cat-suggestions"
                        aria-label="Category"
                      />
                      <input
                        className="input w-full text-sm"
                        value={item.productUrl || ""}
                        onChange={(e) =>
                          updateDraft(item.id, { productUrl: e.target.value || null })
                        }
                        placeholder="Product link (Amazon…)"
                        aria-label="Product link"
                      />
                    </div>
                    <input
                      className="input w-full text-sm"
                      value={item.imageUrl || ""}
                      onChange={(e) =>
                        updateDraft(item.id, { imageUrl: e.target.value || null })
                      }
                      placeholder="Image URL"
                      aria-label="Image URL"
                    />
                    <textarea
                      className="input w-full min-h-[60px] text-sm"
                      value={item.description || ""}
                      onChange={(e) =>
                        updateDraft(item.id, { description: e.target.value || null })
                      }
                      placeholder="Notes for members"
                      aria-label="Description"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-primary min-h-[40px] px-3 text-xs"
                        disabled={savingId === item.id}
                        onClick={() => void saveItem(item)}
                      >
                        {savingId === item.id ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost min-h-[40px] px-3 text-xs"
                        disabled={savingId === item.id || !item.productUrl}
                        onClick={() => void refreshImageFromLink(item)}
                      >
                        Refresh photo from link
                      </button>
                      <button
                        type="button"
                        className="btn-ghost min-h-[40px] px-3 text-xs text-red-300"
                        disabled={deletingId === item.id}
                        onClick={() => void removeItem(item.id, item.name)}
                      >
                        {deletingId === item.id ? "Removing…" : "Delete"}
                      </button>
                      {item.productUrl ? (
                        <a
                          href={item.productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-ghost min-h-[40px] px-3 text-xs"
                        >
                          Open link ↗
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
