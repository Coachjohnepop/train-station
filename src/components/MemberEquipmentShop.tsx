"use client";

import { useCallback, useEffect, useState } from "react";

type ShopItem = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  productUrl: string | null;
  imageUrl: string | null;
};

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
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              <div className="relative flex aspect-square items-center justify-center bg-white p-4">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="max-h-full max-w-full object-contain"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-xs text-[var(--muted)]">No photo</span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 border-t border-[var(--border)] p-4">
                {item.category ? (
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    {item.category}
                  </p>
                ) : null}
                <p className="text-sm font-semibold leading-snug group-hover:text-accent">
                  {item.name}
                </p>
                {item.description ? (
                  <p className="line-clamp-3 text-xs text-[var(--muted)]">{item.description}</p>
                ) : null}
                <p className="mt-auto pt-2 text-xs font-medium text-accent">
                  View on store ↗
                </p>
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
