"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import GearItemEditForm, { type GearEditableItem } from "@/components/GearItemEditForm";
import { canAccessCoachAdmin } from "@/lib/staff-access";
import type { UserRole } from "@/lib/auth-session";
import { equipmentImageProxyPath } from "@/lib/equipment-image-url";

type ShopItem = GearEditableItem;

type OwnedMap = Record<string, boolean>;

function ShopThumb({ item }: { item: ShopItem }) {
  const [failed, setFailed] = useState(false);
  const src =
    !failed && (item.imageUrl || item.productUrl)
      ? equipmentImageProxyPath({ equipmentId: item.id, imageUrl: item.imageUrl })
      : null;

  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--surface-2)] text-[9px] text-[var(--muted)]">
        No photo
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={item.name}
      className="h-full w-full object-contain p-1"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function isOnGearShop(item: ShopItem): boolean {
  return Boolean(item.productUrl?.trim() && item.imageUrl?.trim());
}

export default function MemberEquipmentShop() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [owned, setOwned] = useState<OwnedMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [isCoach, setIsCoach] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAllForCoach, setShowAllForCoach] = useState(false);

  const load = useCallback(async (coach: boolean) => {
    setLoading(true);
    setError("");
    try {
      const shopPromise = fetch("/api/equipment/shop", { cache: "no-store" });
      const homePromise = fetch("/api/equipment", { cache: "no-store" });
      const catalogPromise = coach
        ? fetch("/api/admin/equipment", { cache: "no-store" })
        : Promise.resolve(null);

      const [shopRes, homeRes, catalogRes] = await Promise.all([
        shopPromise,
        homePromise,
        catalogPromise,
      ]);

      const shopData = await shopRes.json().catch(() => ({}));
      const homeData = await homeRes.json().catch(() => ({}));

      if (coach && catalogRes) {
        const catalogData = await catalogRes.json().catch(() => ({}));
        if (catalogRes.ok && Array.isArray(catalogData.equipment)) {
          setItems(catalogData.equipment);
        } else if (shopRes.ok) {
          setItems(shopData.equipment || []);
        } else {
          setError(catalogData.error || shopData.error || "Could not load gear.");
          setItems([]);
        }
      } else if (!shopRes.ok) {
        setError(shopData.error || "Could not load gear.");
        setItems([]);
      } else {
        setItems(shopData.equipment || []);
      }

      if (homeRes.ok && Array.isArray(homeData.equipment)) {
        const map: OwnedMap = {};
        for (const row of homeData.equipment) {
          if (row?.id) map[row.id] = Boolean(row.hasAtHome);
        }
        setOwned(map);
      }
    } catch {
      setError("Could not load gear.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let coach = false;
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        const role = data?.user?.role as UserRole | undefined;
        coach = Boolean(role && canAccessCoachAdmin(role));
      } catch {
        coach = false;
      }
      if (cancelled) return;
      setIsCoach(coach);
      await load(coach);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function markIHaveThis(itemId: string) {
    const nextOwned = !owned[itemId];
    setTogglingId(itemId);
    setOwned((prev) => ({ ...prev, [itemId]: nextOwned }));
    try {
      const resGet = await fetch("/api/equipment", { cache: "no-store" });
      const dataGet = await resGet.json().catch(() => ({}));
      const current = Array.isArray(dataGet.equipment) ? dataGet.equipment : [];
      const payload = current.map(
        (row: {
          id: string;
          hasAtHome: boolean;
          quantity?: number | null;
          notes?: string | null;
        }) => ({
          equipmentId: row.id,
          hasAtHome: row.id === itemId ? nextOwned : Boolean(row.hasAtHome),
          quantity: row.quantity ?? 1,
          notes: row.notes ?? null,
        }),
      );
      if (!payload.some((p: { equipmentId: string }) => p.equipmentId === itemId)) {
        payload.push({
          equipmentId: itemId,
          hasAtHome: nextOwned,
          quantity: 1,
          notes: null,
        });
      }
      const res = await fetch("/api/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipment: payload }),
      });
      if (!res.ok) {
        setOwned((prev) => ({ ...prev, [itemId]: !nextOwned }));
      }
    } catch {
      setOwned((prev) => ({ ...prev, [itemId]: !nextOwned }));
    } finally {
      setTogglingId(null);
    }
  }

  const visibleItems =
    isCoach && showAllForCoach ? items : items.filter((i) => isOnGearShop(i));

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Loading recommended gear…</p>;
  }

  if (error) {
    return <p className="text-sm text-amber-300">{error}</p>;
  }

  return (
    <div className="space-y-3">
      {isCoach ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/25 bg-accent/5 px-3 py-2 text-xs">
          <span className="font-semibold text-accent">Coach edit</span>
          <span className="text-[var(--muted)]">
            Tap <strong className="text-[var(--text)]">Edit</strong> on any item to change name,
            product link, photo, or notes.
          </span>
          <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[var(--muted)]">
            <input
              type="checkbox"
              checked={showAllForCoach}
              onChange={(e) => setShowAllForCoach(e.target.checked)}
            />
            Show all catalog ({items.length})
          </label>
          <Link href="/admin/equipment" className="font-medium text-accent hover:underline">
            Full Equipment admin →
          </Link>
        </div>
      ) : null}

      {visibleItems.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-sm font-medium">No shop links yet</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {isCoach
              ? "Turn on “Show all catalog” to edit home-only items, or add products under Admin → Equipment."
              : "When your coach adds product links, they'll show up here with photos."}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {visibleItems.map((item) => {
            const href = item.productUrl?.trim() || null;
            const hasIt = Boolean(owned[item.id]);
            const onShop = isOnGearShop(item);
            const editing = editingId === item.id;

            return (
              <li key={item.id} className="card flex h-full flex-col overflow-hidden">
                {href && !editing ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-1 flex-col transition hover:border-accent/50 active:scale-[0.99]"
                  >
                    <div className="relative aspect-square w-full bg-white">
                      <ShopThumb item={item} />
                    </div>
                    <div className="flex flex-1 flex-col gap-0.5 border-t border-[var(--border)] p-2">
                      {item.category ? (
                        <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                          {item.category}
                        </p>
                      ) : null}
                      <p className="line-clamp-2 text-[11px] font-semibold leading-snug group-hover:text-accent">
                        {item.name}
                      </p>
                      {item.description ? (
                        <p className="line-clamp-2 text-[10px] text-[var(--muted)]">
                          {item.description}
                        </p>
                      ) : null}
                      <p className="mt-auto pt-1 text-[10px] font-medium text-accent">Store ↗</p>
                    </div>
                  </a>
                ) : (
                  <div className="flex flex-1 flex-col">
                    <div className="relative aspect-square w-full bg-white">
                      <ShopThumb item={item} />
                    </div>
                    <div className="flex flex-1 flex-col gap-0.5 border-t border-[var(--border)] p-2">
                      {item.category ? (
                        <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                          {item.category}
                        </p>
                      ) : null}
                      <p className="line-clamp-2 text-[11px] font-semibold leading-snug">
                        {item.name}
                      </p>
                      {!onShop && isCoach ? (
                        <p className="text-[9px] font-medium text-amber-300">Not on Gear shop yet</p>
                      ) : null}
                    </div>
                  </div>
                )}

                {editing ? (
                  <GearItemEditForm
                    item={item}
                    compact
                    onCancel={() => setEditingId(null)}
                    onSaved={(saved) => {
                      setItems((prev) =>
                        prev
                          .map((row) => (row.id === saved.id ? saved : row))
                          .sort((a, b) => a.name.localeCompare(b.name)),
                      );
                      setEditingId(null);
                    }}
                    onDeleted={(id) => {
                      setItems((prev) => prev.filter((row) => row.id !== id));
                      setEditingId(null);
                    }}
                  />
                ) : (
                  <div className="space-y-1.5 border-t border-[var(--border)] p-2">
                    {isCoach ? (
                      <button
                        type="button"
                        className="w-full rounded-lg bg-[var(--accent)]/15 px-2 py-1.5 text-[10px] font-semibold text-accent hover:bg-[var(--accent)]/25"
                        onClick={() => setEditingId(item.id)}
                      >
                        Edit item
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={`w-full rounded-lg px-2 py-1.5 text-[10px] font-semibold transition ${
                        hasIt
                          ? "bg-emerald-500/20 text-[var(--success)]"
                          : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--text)]"
                      }`}
                      disabled={togglingId === item.id}
                      onClick={() => void markIHaveThis(item.id)}
                    >
                      {togglingId === item.id
                        ? "Saving…"
                        : hasIt
                          ? "✓ I have this"
                          : "Mark: I have this"}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
