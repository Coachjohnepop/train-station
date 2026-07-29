"use client";

import { useState } from "react";
import { formatApiError } from "@/lib/api-errors";
import { equipmentImageProxyPath } from "@/lib/equipment-image-url";

export type GearEditableItem = {
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
  "cardio",
  "recovery",
];

type Props = {
  item: GearEditableItem;
  onSaved: (item: GearEditableItem) => void;
  onCancel: () => void;
  onDeleted?: (id: string) => void;
  /** Compact for member Gear grid; full for admin-style panels */
  compact?: boolean;
};

/**
 * Shared edit form for one equipment catalog row (name, product, photo, notes).
 * Saves via PATCH /api/admin/equipment/:id — coach staff only.
 */
export default function GearItemEditForm({
  item,
  onSaved,
  onCancel,
  onDeleted,
  compact = false,
}: Props) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category || "");
  const [description, setDescription] = useState(item.description || "");
  const [productUrl, setProductUrl] = useState(item.productUrl || "");
  const [imageUrl, setImageUrl] = useState(item.imageUrl || "");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [thumbKey, setThumbKey] = useState(0);

  const previewSrc =
    equipmentImageProxyPath({
      equipmentId: item.id,
      imageUrl: imageUrl || null,
    }) ||
    (productUrl.trim()
      ? equipmentImageProxyPath({ imageUrl: productUrl.trim() })
      : null);

  async function save() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/equipment/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim() || null,
          description: description.trim() || null,
          productUrl: productUrl.trim() || null,
          imageUrl: imageUrl.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || formatApiError(data.detail) || "Could not save.");
        setSaving(false);
        return;
      }
      onSaved({
        id: String(data.id ?? item.id),
        name: String(data.name ?? name),
        category: (data.category as string | null) ?? null,
        description: (data.description as string | null) ?? null,
        productUrl: (data.productUrl as string | null) ?? null,
        imageUrl: (data.imageUrl as string | null) ?? null,
      });
      setThumbKey((k) => k + 1);
    } catch {
      setError("Could not save. Check your connection.");
    } finally {
      setSaving(false);
    }
  }

  async function refreshPhoto() {
    const url = productUrl.trim();
    if (!url) {
      setError("Add a product link first, then refresh photo.");
      return;
    }
    setRefreshing(true);
    setError("");
    try {
      const res = await fetch("/api/admin/equipment/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not pull photo from that link.");
        return;
      }
      if (data.imageUrl) setImageUrl(String(data.imageUrl));
      if (data.url) setProductUrl(String(data.url));
      if (!name.trim() && data.title) setName(String(data.title));
      if (!data.imageUrl) {
        setError("No photo found — paste an Image URL and Save.");
      }
      setThumbKey((k) => k + 1);
    } catch {
      setError("Could not refresh photo.");
    } finally {
      setRefreshing(false);
    }
  }

  async function remove() {
    if (!onDeleted) return;
    if (!window.confirm(`Delete “${item.name}” from the catalog permanently?`)) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/equipment/${encodeURIComponent(item.id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not delete.");
        setDeleting(false);
        return;
      }
      onDeleted(item.id);
    } catch {
      setError("Could not delete.");
      setDeleting(false);
    }
  }

  const fieldClass = compact ? "input w-full text-xs" : "input w-full text-sm";

  return (
    <div
      className={`space-y-2 border-t border-[var(--border)] bg-[var(--surface-2)]/40 ${
        compact ? "p-2" : "p-3"
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex gap-2">
        <div
          className={`shrink-0 overflow-hidden rounded-md border border-[var(--border)] bg-white ${
            compact ? "h-14 w-14" : "h-16 w-16"
          }`}
        >
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={thumbKey}
              src={previewSrc}
              alt=""
              className="h-full w-full object-contain p-0.5"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[9px] text-[var(--muted)]">
              No photo
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <input
            className={fieldClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            aria-label="Name"
            disabled={saving}
          />
          <select
            className={fieldClass}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Category"
            disabled={saving}
          >
            <option value="">No category</option>
            {[
              ...new Set([
                ...CATEGORY_SUGGESTIONS,
                ...(category && !CATEGORY_SUGGESTIONS.includes(category) ? [category] : []),
              ]),
            ]
              .sort()
              .map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-medium text-[var(--muted)]">Product link</label>
        <input
          className={`${fieldClass} mt-0.5`}
          value={productUrl}
          onChange={(e) => setProductUrl(e.target.value)}
          placeholder="https://www.amazon.com/dp/…"
          inputMode="url"
          disabled={saving}
        />
      </div>

      <div>
        <label className="text-[10px] font-medium text-[var(--muted)]">
          Image URL {productUrl.trim() ? "(needed for Gear shop)" : "(optional)"}
        </label>
        <div className="mt-0.5 flex gap-1">
          <input
            className={`${fieldClass} min-w-0 flex-1`}
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://… photo URL"
            disabled={saving}
          />
          <button
            type="button"
            className="btn-ghost shrink-0 px-2 text-[10px]"
            disabled={saving || refreshing || !productUrl.trim()}
            onClick={() => void refreshPhoto()}
            title="Pull photo from product link"
          >
            {refreshing ? "…" : "↻ Photo"}
          </button>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-medium text-[var(--muted)]">Notes for members</label>
        <textarea
          className={`${fieldClass} mt-0.5 min-h-[48px]`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Why you recommend this…"
          disabled={saving}
        />
      </div>

      {error ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1.5 pt-0.5">
        <button
          type="button"
          className="btn-primary min-h-[36px] flex-1 px-3 text-xs sm:flex-none"
          disabled={saving || deleting}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="btn-ghost min-h-[36px] px-3 text-xs"
          disabled={saving || deleting}
          onClick={onCancel}
        >
          Cancel
        </button>
        {onDeleted ? (
          <button
            type="button"
            className="btn-ghost min-h-[36px] px-3 text-xs text-red-300"
            disabled={saving || deleting}
            onClick={() => void remove()}
          >
            {deleting ? "…" : "Delete"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
