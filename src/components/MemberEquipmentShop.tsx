"use client";

import { useCallback, useEffect, useState } from "react";
import { equipmentImageProxyPath } from "@/lib/equipment-image-url";

type ShopItem = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  productUrl: string | null;
  imageUrl: string | null;
};

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

export default function MemberEquipmentShop() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [owned, setOwned] = useState<OwnedMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [shopRes, homeRes] = await Promise.all([
        fetch("/api/equipment/shop", { cache: "no-store" }),
        fetch("/api/equipment", { cache: "no-store" }),
      ]);
      const shopData = await shopRes.json().catch(() => ({}));
      const homeData = await homeRes.json().catch(() => ({}));
      if (!shopRes.ok) {
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
    void load();
  }, [load]);

  async function markIHaveThis(itemId: string) {
    const nextOwned = !owned[itemId];
    setTogglingId(itemId);
    // Optimistic
    setOwned((prev) => ({ ...prev, [itemId]: nextOwned }));
    try {
      // Merge with full checklist so we don't wipe other gear
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

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Loading recommended gear…</p>;
  }

  if (error) {
    return <p className="text-sm text-amber-300">{error}</p>;
  }

  if (items.length === 0) {
    return (
      <div className="card p-6 text-center">
        <p className="text-sm font-medium">No shop links yet</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          When your coach adds product links, they&apos;ll show up here with photos.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {items.map((item) => {
        const href = item.productUrl!;
        const hasIt = Boolean(owned[item.id]);
        return (
          <li key={item.id} className="card flex h-full flex-col overflow-hidden">
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
                  <p className="line-clamp-2 text-[10px] text-[var(--muted)]">{item.description}</p>
                ) : null}
                <p className="mt-auto pt-1 text-[10px] font-medium text-accent">Store ↗</p>
              </div>
            </a>
            <div className="border-t border-[var(--border)] p-2">
              <button
                type="button"
                className={`w-full rounded-lg px-2 py-1.5 text-[10px] font-semibold transition ${
                  hasIt
                    ? "bg-emerald-500/20 text-emerald-100"
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
          </li>
        );
      })}
    </ul>
  );
}
