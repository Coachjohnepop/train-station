"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PROGRAM_IMAGES, CATEGORY_LABELS } from "@/lib/program-constants";
import {
  CART_STORAGE_KEY,
  categoryLabel,
  formatMoney,
  getProgramListPrice,
  type CatalogProgram,
} from "@/lib/program-pricing";

const CATEGORY_ORDER = ["workout", "yoga", "journey", "eating"] as const;

type Props = {
  programs: CatalogProgram[];
  enrolledSlugs: string[];
};

export default function ProgramCatalog({ programs, enrolledSlugs }: Props) {
  const router = useRouter();
  const enrolledSet = useMemo(() => new Set(enrolledSlugs), [enrolledSlugs]);
  const [cartSlugs, setCartSlugs] = useState<string[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const programBySlug = useMemo(
    () => Object.fromEntries(programs.map((p) => [p.slug, p])),
    [programs],
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        if (Array.isArray(parsed)) setCartSlugs(parsed.filter((s) => programBySlug[s]));
      }
    } catch {
      /* ignore */
    }
  }, [programBySlug]);

  const persistCart = useCallback((next: string[]) => {
    setCartSlugs(next);
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const cartItems = cartSlugs
    .map((slug) => programBySlug[slug])
    .filter(Boolean) as CatalogProgram[];

  const cartTotalCents = cartItems.reduce((sum, p) => sum + getProgramListPrice(p).cents, 0);

  function toggleCart(slug: string) {
    if (enrolledSet.has(slug)) return;
    if (cartSlugs.includes(slug)) {
      persistCart(cartSlugs.filter((s) => s !== slug));
    } else {
      persistCart([...cartSlugs, slug]);
      setCartOpen(true);
    }
  }

  function removeFromCart(slug: string) {
    persistCart(cartSlugs.filter((s) => s !== slug));
  }

  async function handleCheckout() {
    if (cartItems.length === 0) return;
    setCheckingOut(true);
    setMessage(null);
    const enrolled: string[] = [];
    const failed: string[] = [];
    let redirectTo: string | null = null;

    for (const program of cartItems) {
      try {
        const res = await fetch(`/api/programs/${program.slug}/enroll`, { method: "POST" });
        if (res.ok) {
          enrolled.push(program.slug);
          const data = await res.json().catch(() => ({}));
          if (typeof data.redirectTo === "string") redirectTo = data.redirectTo;
        } else failed.push(program.name);
      } catch {
        failed.push(program.name);
      }
    }

    if (enrolled.length > 0) {
      persistCart(cartSlugs.filter((s) => !enrolled.includes(s)));
      if (failed.length === 0) {
        const slug = enrolled[0]!;
        router.push(redirectTo || `/member/workout?program=${encodeURIComponent(slug)}`);
        router.refresh();
        return;
      }
      setMessage(`Enrolled in ${enrolled.length} program(s). ${failed.length} failed — try again.`);
      router.refresh();
    } else {
      setMessage("Could not enroll — please try again.");
    }
    setCheckingOut(false);
  }

  const grouped = programs.reduce((acc: Record<string, CatalogProgram[]>, p) => {
    const c = p.category || "workout";
    if (!acc[c]) acc[c] = [];
    acc[c].push(p);
    return acc;
  }, {});

  return (
    <div className={cartItems.length > 0 ? "pb-28" : "pb-4"}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Program store</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Browse programs like a shop — add what you want, then check out. Stripe payments plug in next; enrollment is free during preview.
          </p>
        </div>
        {cartItems.length > 0 && (
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="btn-ghost text-sm ring-1 ring-accent/40"
          >
            Cart ({cartItems.length})
          </button>
        )}
      </div>

      {message && (
        <p className="mt-3 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm">{message}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-[var(--muted)]">
        <span className="rounded-full bg-[var(--surface-2)] px-2 py-1">1. Add programs to cart</span>
        <span className="rounded-full bg-[var(--surface-2)] px-2 py-1">2. Review your plan</span>
        <span className="rounded-full bg-[var(--surface-2)] px-2 py-1">3. Enroll (Stripe soon)</span>
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const progs = grouped[cat] || [];
        if (progs.length === 0) return null;
        const eatingSoon = cat === "eating";

        return (
          <section key={cat} className="mt-8">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">
                {CATEGORY_LABELS[cat] || cat}
              </h2>
              {eatingSoon && (
                <span className="text-[10px] rounded bg-amber-500/15 px-2 py-0.5 text-amber-300">Coming soon</span>
              )}
            </div>

            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {progs.map((program) => {
                const img = PROGRAM_IMAGES[program.slug] || "/images/programs/adult.jpg";
                const price = getProgramListPrice(program);
                const isEnrolled = enrolledSet.has(program.slug);
                const inCart = cartSlugs.includes(program.slug);
                const comingSoon = program.catalogStatus === "coming_soon";
                const countLabel =
                  cat === "workout"
                    ? `${program.workoutCount || 0} sessions`
                    : cat === "yoga"
                      ? "Flows & sessions"
                      : cat === "journey"
                        ? "Recorded sessions"
                        : "Daily prompts";

                return (
                  <li
                    key={program.id}
                    className={`card flex flex-col overflow-hidden p-0 transition ${
                      inCart ? "ring-2 ring-accent/50" : "hover-accent-border"
                    }`}
                  >
                    <Link href={`/member/programs/${program.slug}`} className="block">
                      <div className="relative aspect-[16/10] w-full overflow-hidden">
                        <img src={img} alt="" className="h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute left-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                          {price.label}
                        </div>
                        {comingSoon && !isEnrolled && (
                          <div className="absolute right-3 top-3 rounded-full bg-amber-500/80 px-2 py-0.5 text-[10px] font-semibold text-black">
                            Coming soon
                          </div>
                        )}
                        {isEnrolled && (
                          <div className="absolute right-3 top-3 rounded-full bg-[var(--success)] px-2 py-0.5 text-[10px] font-semibold text-white">
                            Enrolled
                          </div>
                        )}
                        <h3 className="absolute bottom-3 left-3 right-3 text-lg font-semibold text-white">
                          {program.name}
                        </h3>
                      </div>
                    </Link>

                    <div className="flex flex-1 flex-col p-4">
                      {program.description && (
                        <p className="text-sm text-[var(--muted)] line-clamp-2">{program.description}</p>
                      )}
                      <p className="mt-2 text-xs text-[var(--muted)]">{countLabel}</p>
                      <p className="mt-1 text-[10px] text-[var(--muted)]">{price.futureLabel}</p>

                      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                        <Link
                          href={`/member/programs/${program.slug}`}
                          className="text-xs text-accent hover:underline"
                        >
                          Preview →
                        </Link>

                        {isEnrolled ? (
                          <span className="ml-auto text-xs font-medium text-[var(--success)]">In your plan ✓</span>
                        ) : eatingSoon || comingSoon ? (
                          <button
                            type="button"
                            disabled
                            className="ml-auto rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)]"
                          >
                            Notify me
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleCart(program.slug)}
                            className={`ml-auto rounded-lg px-4 py-2 text-xs font-semibold transition ${
                              inCart
                                ? "bg-accent/20 text-accent ring-1 ring-accent/50"
                                : "bg-accent text-black hover:bg-accent/90"
                            }`}
                          >
                            {inCart ? "Added ✓" : "Add to cart"}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {/* Cart drawer */}
      {cartOpen && cartItems.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close cart"
            onClick={() => setCartOpen(false)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <h2 className="font-semibold">Your cart</h2>
              <button type="button" onClick={() => setCartOpen(false)} className="text-sm text-[var(--muted)] hover:text-white">
                Close
              </button>
            </div>

            <ul className="max-h-[50vh] overflow-y-auto divide-y divide-[var(--border)]">
              {cartItems.map((program) => {
                const price = getProgramListPrice(program);
                const img = PROGRAM_IMAGES[program.slug] || "/images/programs/adult.jpg";
                return (
                  <li key={program.slug} className="flex gap-3 px-4 py-3">
                    <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg">
                      <img src={img} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{program.name}</p>
                      <p className="text-[10px] text-[var(--muted)]">{categoryLabel(program.category)}</p>
                      <p className="text-xs text-accent mt-0.5">{price.label}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(program.slug)}
                      className="shrink-0 text-xs text-[var(--muted)] hover:text-[var(--danger)]"
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="border-t border-[var(--border)] px-4 py-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--muted)]">Subtotal (preview)</span>
                <span className="font-semibold tabular-nums">{formatMoney(cartTotalCents)}</span>
              </div>
              <p className="text-[10px] text-[var(--muted)]">
                Stripe checkout connects here next. For now, completing checkout enrolls you immediately at no charge.
              </p>
              <button
                type="button"
                disabled={checkingOut || cartItems.length === 0}
                onClick={handleCheckout}
                className="btn-primary w-full"
              >
                {checkingOut ? "Enrolling…" : `Complete enrollment (${cartItems.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky cart bar */}
      {cartItems.length > 0 && !cartOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.35)]">
          <div className="mx-auto flex max-w-lg md:max-w-3xl lg:max-w-6xl items-center justify-between gap-3">
            <button type="button" onClick={() => setCartOpen(true)} className="flex items-center gap-2 text-left">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-black">
                {cartItems.length}
              </span>
              <div>
                <p className="text-sm font-semibold">
                  {cartItems.length} program{cartItems.length === 1 ? "" : "s"} in cart
                </p>
                <p className="text-[10px] text-[var(--muted)]">Tap to review · {formatMoney(cartTotalCents)} preview</p>
              </div>
            </button>
            <button
              type="button"
              disabled={checkingOut}
              onClick={handleCheckout}
              className="btn-primary shrink-0 px-5 py-2 text-sm"
            >
              {checkingOut ? "…" : "Checkout"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}