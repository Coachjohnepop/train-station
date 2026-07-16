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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/equipment/shop", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not load gear.");
        setItems([]);
      } else {
        setItems(data.equipment || []);
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
        return (
          <li key={item.id}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="card group flex h-full flex-col overflow-hidden transition hover:border-accent/50 active:scale-[0.99]"
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
          </li>
        );
      })}
    </ul>
  );
}
