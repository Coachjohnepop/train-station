"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { formatApiError } from "@/lib/api-errors";
import { equipmentImageProxyPath } from "@/lib/equipment-image-url";

type EquipmentItem = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  productUrl: string | null;
  imageUrl: string | null;
};

/** Built-in suggestions; coaches can add freeform categories via "Add category…". */
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

const ADD_CATEGORY_VALUE = "__add_category__";
const NONE_CATEGORY_VALUE = "";

function mergeCategoryOptions(
  items: EquipmentItem[],
  extra: string[] = [],
): string[] {
  const set = new Set<string>();
  for (const c of CATEGORY_SUGGESTIONS) {
    if (c.trim()) set.add(c.trim());
  }
  for (const item of items) {
    const c = item.category?.trim();
    if (c) set.add(c);
  }
  for (const c of extra) {
    if (c.trim()) set.add(c.trim());
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function ProductThumb({
  name,
  imageUrl,
  productUrl,
  equipmentId,
  /** compact = small square; card = full-width tile on multi-column grid */
  variant = "compact",
}: {
  name: string;
  imageUrl: string | null;
  productUrl?: string | null;
  equipmentId?: string | null;
  variant?: "compact" | "card";
}) {
  const [failed, setFailed] = useState(false);

  let src: string | null = null;
  if (!failed) {
    if (equipmentId) {
      src = equipmentImageProxyPath({ equipmentId });
    } else if (imageUrl) {
      src = equipmentImageProxyPath({ imageUrl });
    } else if (productUrl) {
      // Unsaved Amazon (etc.) link — proxy resolves ASIN photo from product URL
      src = equipmentImageProxyPath({ imageUrl: productUrl });
    }
  }

  const shellClass =
    variant === "card"
      ? "block aspect-[4/3] w-full overflow-hidden rounded-t-lg border-b border-[var(--border)] bg-white"
      : "h-14 w-14 shrink-0 overflow-hidden rounded-md border border-[var(--border)] bg-white";

  if (!src) {
    return (
      <div
        className={
          variant === "card"
            ? "flex aspect-[4/3] w-full items-center justify-center rounded-t-lg border-b border-[var(--border)] bg-[var(--surface-2)] text-[10px] text-[var(--muted)]"
            : "flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-[8px] text-[var(--muted)]"
        }
      >
        No photo
      </div>
    );
  }

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className={
        variant === "card"
          ? "h-full w-full object-contain p-2"
          : "h-full w-full object-contain p-0.5"
      }
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );

  if (productUrl) {
    return (
      <a
        href={productUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={shellClass}
        title="Open product (new tab)"
      >
        {img}
      </a>
    );
  }

  return <div className={shellClass}>{img}</div>;
}

/**
 * Category dropdown with built-in + catalog values, plus "Add category…" for freeform.
 */
function EquipmentCategorySelect({
  id,
  value,
  options,
  onChange,
  onCategoryCreated,
  disabled,
  className,
}: {
  id?: string;
  value: string;
  options: string[];
  onChange: (category: string) => void;
  /** Called when coach adds a brand-new category name (so lists update). */
  onCategoryCreated?: (category: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const selectValue = adding
    ? ADD_CATEGORY_VALUE
    : value && options.includes(value)
      ? value
      : value
        ? value
        : NONE_CATEGORY_VALUE;

  // Ensure current custom value appears even if not in options yet
  const listOptions =
    value && !options.includes(value) ? [...options, value].sort((a, b) => a.localeCompare(b)) : options;

  function commitNewCategory() {
    const next = draft.trim();
    if (!next) {
      setAdding(false);
      setDraft("");
      return;
    }
    onChange(next);
    onCategoryCreated?.(next);
    setAdding(false);
    setDraft("");
  }

  return (
    <div className="space-y-1.5">
      <select
        id={id}
        className={className ?? "input mt-1 w-full"}
        value={selectValue}
        disabled={disabled}
        aria-label="Category"
        onChange={(e) => {
          const v = e.target.value;
          if (v === ADD_CATEGORY_VALUE) {
            setAdding(true);
            setDraft(value || "");
            return;
          }
          setAdding(false);
          setDraft("");
          onChange(v);
        }}
      >
        <option value={NONE_CATEGORY_VALUE}>No category</option>
        {listOptions.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        <option value={ADD_CATEGORY_VALUE}>+ Add category…</option>
      </select>
      {adding && (
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
          <input
            className="input w-full flex-1 text-sm"
            value={draft}
            autoFocus
            placeholder="New category name"
            aria-label="New category name"
            disabled={disabled}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitNewCategory();
              }
              if (e.key === "Escape") {
                setAdding(false);
                setDraft("");
              }
            }}
          />
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              className="btn-primary min-h-[36px] px-3 text-xs"
              disabled={disabled || !draft.trim()}
              onClick={() => commitNewCategory()}
            >
              Add
            </button>
            <button
              type="button"
              className="btn-ghost min-h-[36px] px-3 text-xs"
              disabled={disabled}
              onClick={() => {
                setAdding(false);
                setDraft("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
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
  /** Coach-created category names not yet on any item (or still only in form). */
  const [extraCategories, setExtraCategories] = useState<string[]>([]);

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

  const categoryOptions = useMemo(
    () => mergeCategoryOptions(items, extraCategories),
    [items, extraCategories],
  );

  function rememberCategory(category: string) {
    const c = category.trim();
    if (!c) return;
    setExtraCategories((prev) => (prev.includes(c) ? prev : [...prev, c]));
  }

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
    <div className="w-full max-w-none space-y-6">
      {error && <p className="text-sm text-amber-400">{error}</p>}

      <form
        onSubmit={createItem}
        className="card space-y-4 p-4 sm:p-5"
      >
        <div className="max-w-3xl">
          <h2 className="text-sm font-semibold">Add from product link</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Paste an Amazon (or other store) link. We pull the title and a photo when the site
            allows. Members see the image on <strong>Gear</strong> and open the store in a{" "}
            <strong>new tab</strong> only.
          </p>
        </div>

        {/* Mobile: stack · sm+: link + action · lg+: 3-col workspace */}
        <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
          <div className="space-y-3 lg:col-span-2">
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
                className="btn-ghost min-h-[44px] w-full shrink-0 px-4 text-sm sm:w-auto"
                disabled={previewing || !pasteUrl.trim()}
                onClick={() => void previewFromLink()}
              >
                {previewing ? "Reading link…" : "Get photo & title"}
              </button>
            </div>

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
                <EquipmentCategorySelect
                  id="eq-cat"
                  value={newCategory}
                  options={categoryOptions}
                  onChange={setNewCategory}
                  onCategoryCreated={rememberCategory}
                  disabled={creating}
                />
              </div>
              <div>
                <label htmlFor="eq-img" className="text-xs font-medium text-[var(--muted)]">
                  Image URL (optional)
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
                  className="input mt-1 w-full min-h-[64px]"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Why you recommend this, size tips…"
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary min-h-[44px] w-full px-4 text-sm sm:w-auto"
              disabled={creating}
            >
              {creating ? "Adding…" : "Add equipment"}
            </button>
          </div>

          <div className="lg:col-span-1">
            {newImageUrl || newName || newProductUrl || pasteUrl ? (
              <div className="overflow-hidden rounded-lg border border-accent/25 bg-accent/5">
                <ProductThumb
                  name={newName || "Preview"}
                  imageUrl={newImageUrl || null}
                  productUrl={newProductUrl || pasteUrl || null}
                  variant="card"
                />
                <div className="space-y-1 p-3 text-xs text-[var(--muted)]">
                  <p className="font-medium text-[var(--text)]">Preview</p>
                  <p className="line-clamp-3 break-words">{newName || "—"}</p>
                  {(newProductUrl || pasteUrl) && (
                    <p className="truncate text-[10px] opacity-80">
                      {newProductUrl || pasteUrl}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="hidden rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-4 text-center text-xs text-[var(--muted)] lg:block">
                Photo preview appears here after you paste a link.
              </div>
            )}
          </div>
        </div>
      </form>

      <div>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Catalog</h2>
          <p className="text-xs text-[var(--muted)]">
            {items.length} item{items.length === 1 ? "" : "s"}
            {shopCount > 0 ? ` · ${shopCount} with shop link` : ""}
            <span className="hidden sm:inline"> · multi-column layout</span>
          </p>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No equipment yet. Paste a product link above to add the first piece.
          </p>
        ) : (
          /* auto-fill: 1 col on phones, 2–3 as soon as width allows (not stuck waiting for xl) */
          <ul
            className="equipment-catalog-grid grid w-full gap-3"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 17.5rem), 1fr))",
            }}
          >
            {items.map((item) => (
              <li
                key={item.id}
                className="card flex h-full min-w-0 flex-col overflow-hidden p-0"
              >
                <ProductThumb
                  name={item.name}
                  imageUrl={item.imageUrl}
                  productUrl={item.productUrl}
                  equipmentId={item.id}
                  variant="card"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
                  <input
                    className="input w-full text-sm font-medium"
                    value={item.name}
                    onChange={(e) => updateDraft(item.id, { name: e.target.value })}
                    aria-label="Name"
                  />
                  <EquipmentCategorySelect
                    value={item.category || ""}
                    options={categoryOptions}
                    className="input w-full text-sm"
                    onChange={(category) =>
                      updateDraft(item.id, { category: category || null })
                    }
                    onCategoryCreated={rememberCategory}
                    disabled={savingId === item.id}
                  />
                  <input
                    className="input w-full text-xs"
                    value={item.productUrl || ""}
                    onChange={(e) =>
                      updateDraft(item.id, { productUrl: e.target.value || null })
                    }
                    placeholder="Product link (Amazon…)"
                    aria-label="Product link"
                  />
                  <input
                    className="input w-full text-xs"
                    value={item.imageUrl || ""}
                    onChange={(e) =>
                      updateDraft(item.id, { imageUrl: e.target.value || null })
                    }
                    placeholder="Image URL"
                    aria-label="Image URL"
                  />
                  <textarea
                    className="input w-full min-h-[52px] flex-1 text-xs"
                    value={item.description || ""}
                    onChange={(e) =>
                      updateDraft(item.id, { description: e.target.value || null })
                    }
                    placeholder="Notes for members"
                    aria-label="Description"
                  />
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                    <button
                      type="button"
                      className="btn-primary min-h-[40px] flex-1 px-2 text-xs sm:flex-none sm:px-3"
                      disabled={savingId === item.id}
                      onClick={() => void saveItem(item)}
                    >
                      {savingId === item.id ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost min-h-[40px] px-2 text-xs sm:px-3"
                      disabled={savingId === item.id || !item.productUrl}
                      onClick={() => void refreshImageFromLink(item)}
                      title="Refresh photo from product link"
                    >
                      Refresh photo
                    </button>
                    <button
                      type="button"
                      className="btn-ghost min-h-[40px] px-2 text-xs text-red-300 sm:px-3"
                      disabled={deletingId === item.id}
                      onClick={() => void removeItem(item.id, item.name)}
                    >
                      {deletingId === item.id ? "…" : "Delete"}
                    </button>
                    {item.productUrl ? (
                      <a
                        href={item.productUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost min-h-[40px] px-2 text-xs sm:px-3"
                      >
                        Store ↗
                      </a>
                    ) : null}
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
