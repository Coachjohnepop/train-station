"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import GearItemEditForm from "@/components/GearItemEditForm";
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

/** Publish state for coach: Gear shop vs home checklist only vs blocked. */
function equipmentPublishStatus(item: {
  productUrl: string | null;
  imageUrl: string | null;
}): { label: string; className: string; title: string } {
  const hasProduct = Boolean(item.productUrl?.trim());
  const hasImage = Boolean(item.imageUrl?.trim());
  if (hasProduct && hasImage) {
    return {
      label: "On Gear ✓",
      className: "bg-emerald-500/20 text-emerald-100",
      title: "Members see this in Gear shop (product link + photo).",
    };
  }
  if (hasProduct && !hasImage) {
    return {
      label: "Blocked: needs photo",
      className: "bg-amber-500/20 text-amber-100",
      title: "Product link without photo cannot publish to Gear. Refresh photo or paste Image URL.",
    };
  }
  return {
    label: "Home checklist only",
    className: "bg-white/10 text-[var(--muted)]",
    title: "No store link — members can mark it on home equipment, not Gear shop.",
  };
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

function toCatalogItem(data: Record<string, unknown>): EquipmentItem {
  return {
    id: String(data.id ?? ""),
    name: String(data.name ?? ""),
    category: (data.category as string | null) ?? null,
    description: (data.description as string | null) ?? null,
    productUrl: (data.productUrl as string | null) ?? null,
    imageUrl: (data.imageUrl as string | null) ?? null,
  };
}

export default function AdminEquipmentCatalog() {
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [storage, setStorage] = useState<"postgres" | "demo" | null>(null);
  const [creating, setCreating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  /** Which catalog card is open for editing (one at a time keeps the grid clean). */
  const [editingId, setEditingId] = useState<string | null>(null);

  const [pasteUrl, setPasteUrl] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newProductUrl, setNewProductUrl] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  /** Coach-created category names not yet on any item (or still only in form). */
  const [extraCategories, setExtraCategories] = useState<string[]>([]);

  const flashSuccess = useCallback((msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 4000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/equipment", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not load equipment catalog.");
      setItems([]);
    } else {
      setItems(data.equipment || []);
      if (data.storage === "postgres" || data.storage === "demo") {
        setStorage(data.storage);
      }
      setEditingId(null);
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
      if (!data.imageUrl) {
        setSuccess(
          "Link read — no auto photo. Paste an Image URL below if you want a custom picture, then Add.",
        );
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
    setSuccess("");
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
    if (data.storage === "postgres" || data.storage === "demo") {
      setStorage(data.storage);
    }
    // Re-load from server so coach sees the DB row, not just local optimistic UI
    await load();
    setPasteUrl("");
    setNewName("");
    setNewCategory("");
    setNewDescription("");
    setNewProductUrl("");
    setNewImageUrl("");
    flashSuccess(
      data.storage === "postgres"
        ? `Saved “${data.name}” to the database. Edit or delete anytime below.`
        : `Saved “${data.name}” (demo storage).`,
    );
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Loading equipment catalog…</p>;
  }

  const shopCount = items.filter((i) => i.productUrl).length;
  const storageLabel =
    storage === "postgres"
      ? "Postgres database"
      : storage === "demo"
        ? "Demo file storage"
        : "Catalog";

  return (
    <div className="w-full max-w-none space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 font-medium text-[var(--muted)]">
          Storage:{" "}
          <span className={storage === "postgres" ? "text-emerald-300" : "text-[var(--text)]"}>
            {storageLabel}
          </span>
        </span>
        <span className="text-[var(--muted)]">
          Gear publish rule: a product link requires a working photo (auto or override). Save fails
          until the image loads.
        </span>
      </div>

      {error && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {success}
        </p>
      )}

      <form onSubmit={createItem} className="card max-w-xl space-y-3 p-4 sm:p-5">
        <div>
          <h2 className="text-sm font-semibold">Add from product link</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Paste a store link → Get photo & title → <strong>Add equipment</strong>. We verify the
            photo loads before publishing to <strong>Gear</strong>. No working image = blocked.
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
            className="btn-ghost min-h-[44px] w-full shrink-0 px-4 text-sm sm:w-auto"
            disabled={previewing || !pasteUrl.trim()}
            onClick={() => void previewFromLink()}
          >
            {previewing ? "Reading link…" : "Get photo & title"}
          </button>
        </div>

        {(newImageUrl || newName || newProductUrl) && (
          <div className="flex items-start gap-3 rounded-lg border border-accent/25 bg-accent/5 p-3">
            <ProductThumb
              name={newName || "Preview"}
              imageUrl={newImageUrl || null}
              productUrl={newProductUrl || pasteUrl || null}
              variant="compact"
            />
            <div className="min-w-0 flex-1 text-xs text-[var(--muted)]">
              <p className="font-medium text-[var(--text)]">Preview</p>
              <p className="mt-0.5 line-clamp-2 break-words">{newName || "—"}</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div>
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
              Image URL (optional override)
            </label>
            <input
              id="eq-img"
              className="input mt-1 w-full"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              placeholder="https://… — paste if auto photo fails"
            />
            <p className="mt-1 text-[10px] text-[var(--muted)]">
              Required for Gear when you have a product link. If auto-photo fails, paste a public
              image URL that works in your browser.
            </p>
          </div>
          <div>
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
      </form>

      <div>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Catalog</h2>
          <p className="text-xs text-[var(--muted)]">
            {items.length} item{items.length === 1 ? "" : "s"}
            {shopCount > 0 ? ` · ${shopCount} on Gear shop` : ""}
            <span className="ml-1 text-[var(--muted)]">· tap Edit on any card</span>
            <button
              type="button"
              className="ml-2 text-accent hover:underline"
              onClick={() => void load()}
            >
              Reload from DB
            </button>
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
            {items.map((item) => {
              const status = equipmentPublishStatus(item);
              const editing = editingId === item.id;
              return (
                <li
                  key={item.id}
                  className="card flex h-full min-w-0 flex-col overflow-hidden p-0"
                >
                  <ProductThumb
                    name={item.name}
                    imageUrl={item.imageUrl}
                    productUrl={editing ? null : item.productUrl}
                    equipmentId={item.id}
                    variant="card"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
                    <span
                      className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${status.className}`}
                      title={status.title}
                    >
                      {status.label}
                    </span>
                    <p className="text-sm font-semibold leading-snug text-[var(--text)]">
                      {item.name}
                    </p>
                    {item.category ? (
                      <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                        {item.category}
                      </p>
                    ) : null}
                    {item.description ? (
                      <p className="line-clamp-2 text-xs text-[var(--muted)]">{item.description}</p>
                    ) : null}
                    {!editing ? (
                      <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                        <button
                          type="button"
                          className="btn-primary min-h-[40px] flex-1 px-3 text-xs"
                          onClick={() => setEditingId(item.id)}
                        >
                          Edit
                        </button>
                        {item.productUrl ? (
                          <a
                            href={item.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-ghost min-h-[40px] px-3 text-xs"
                          >
                            Store ↗
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  {editing ? (
                    <GearItemEditForm
                      item={item}
                      onCancel={() => setEditingId(null)}
                      onSaved={(saved) => {
                        setItems((prev) =>
                          prev
                            .map((row) => (row.id === saved.id ? { ...row, ...saved } : row))
                            .sort((a, b) => a.name.localeCompare(b.name)),
                        );
                        setEditingId(null);
                        flashSuccess(`Updated “${saved.name}” in the database.`);
                      }}
                      onDeleted={(id) => {
                        setItems((prev) => prev.filter((row) => row.id !== id));
                        setEditingId(null);
                        flashSuccess("Deleted from the catalog.");
                      }}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
