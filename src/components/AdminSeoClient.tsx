"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SiteSeoConfig } from "@/lib/site-seo-store";

type SeoResponse = {
  ok?: boolean;
  seo?: SiteSeoConfig;
  origin?: string;
  robotsUrl?: string;
  sitemapUrl?: string;
  publicPaths?: Array<{ path: string; priority: number }>;
  error?: string;
};

function charHint(len: number, idealMin: number, idealMax: number): string {
  if (len === 0) return "Empty — will fall back to defaults on save if left blank after normalize.";
  if (len < idealMin) return `${len} chars — a bit short (aim ${idealMin}–${idealMax}).`;
  if (len > idealMax) return `${len} chars — long for SERPs (aim ≤${idealMax}).`;
  return `${len} chars — good length.`;
}

export default function AdminSeoClient() {
  const [seo, setSeo] = useState<SiteSeoConfig | null>(null);
  const [origin, setOrigin] = useState("https://www.thetrainstation.co");
  const [robotsUrl, setRobotsUrl] = useState("");
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [publicPaths, setPublicPaths] = useState<Array<{ path: string; priority: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/seo", { cache: "no-store" });
      const body = (await res.json()) as SeoResponse;
      if (!res.ok || !body.seo) {
        setError(body.error || "Could not load SEO settings (platform staff only).");
        setSeo(null);
        return;
      }
      setSeo(body.seo);
      if (body.origin) setOrigin(body.origin);
      if (body.robotsUrl) setRobotsUrl(body.robotsUrl);
      if (body.sitemapUrl) setSitemapUrl(body.sitemapUrl);
      if (body.publicPaths) setPublicPaths(body.publicPaths);
    } catch {
      setError("Could not load SEO settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function patch<K extends keyof SiteSeoConfig>(key: K, value: SiteSeoConfig[K]) {
    setSeo((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSave() {
    if (!seo) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metaTitle: seo.metaTitle,
          metaDescription: seo.metaDescription,
          ogTitle: seo.ogTitle,
          ogDescription: seo.ogDescription,
          ogImageUrl: seo.ogImageUrl,
          ogImageAlt: seo.ogImageAlt,
          keywords: seo.keywords,
          robotsIndex: seo.robotsIndex,
          robotsFollow: seo.robotsFollow,
          googleSiteVerification: seo.googleSiteVerification,
          bingSiteVerification: seo.bingSiteVerification,
        }),
      });
      const body = (await res.json()) as SeoResponse;
      if (!res.ok || !body.seo) {
        setError(body.error || "Save failed.");
        return;
      }
      setSeo(body.seo);
      setMessage("Search settings saved — titles, robots, and sitemap use these values.");
    } catch {
      setError("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePingEngines() {
    setPinging(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/seo/submit", { method: "POST" });
      const body = (await res.json()) as {
        ok?: boolean;
        sitemap?: string;
        results?: Array<{ engine: string; ok: boolean; detail: string }>;
        error?: string;
        note?: string;
      };
      if (!res.ok) {
        setError(body.error || "Could not ping search engines.");
        return;
      }
      const lines = (body.results || [])
        .map((r) => `${r.engine}: ${r.ok ? "asked" : r.detail}`)
        .join(" · ");
      setMessage(`${lines}. ${body.note || ""}`.trim());
    } catch {
      setError("Could not ping search engines.");
    } finally {
      setPinging(false);
    }
  }

  const titleLen = seo?.metaTitle.length ?? 0;
  const descLen = seo?.metaDescription.length ?? 0;

  const ogPreviewUrl = useMemo(() => {
    if (!seo?.ogImageUrl) return "";
    if (seo.ogImageUrl.startsWith("http")) return seo.ogImageUrl;
    return `${origin.replace(/\/$/, "")}${seo.ogImageUrl.startsWith("/") ? "" : "/"}${seo.ogImageUrl}`;
  }, [seo?.ogImageUrl, origin]);

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Loading SEO desk…</p>;
  }

  if (!seo) {
    return (
      <div className="space-y-3">
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error || "SEO desk unavailable."}
        </p>
        <button type="button" className="btn-ghost text-sm" onClick={() => void load()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Search</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Get <span className="font-medium text-[var(--text)]">thetrainstation.co</span> found as{" "}
          <strong>The Train Station</strong> — Coach Jeremy’s training app. Titles, share cards,
          robots, sitemap, and “please recrawl” pings for Google and Bing (Safari uses Google).
        </p>
      </div>

      <section className="space-y-3 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
        <h2 className="text-lg font-semibold">Why Safari showed a railroad</h2>
        <p className="text-sm text-[var(--muted)]">
          Typing <strong className="text-[var(--text)]">train station</strong> on an iPhone is a
          maps query. Apple and Google will show Amtrak, metro stops, and “near me” — not a coaching
          app. We cannot outrank the world’s train stations for those two words.
        </p>
        <p className="text-sm text-[var(--muted)]">
          What we can win: <strong className="text-[var(--text)]">The Train Station</strong>,{" "}
          <strong className="text-[var(--text)]">The Train Station coaching</strong>,{" "}
          <strong className="text-[var(--text)]">thetrainstation.co</strong>, and{" "}
          <strong className="text-[var(--text)]">Coach Jeremy Train Station</strong>. Ask people
          (and your wife) to search those.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handlePingEngines()}
            disabled={pinging}
            className="btn-primary px-4 py-2 text-sm font-semibold"
          >
            {pinging ? "Asking Google & Bing…" : "Ask Google & Bing to recrawl us"}
          </button>
          <a
            href="https://search.google.com/search-console"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost px-4 py-2 text-sm"
          >
            Google Search Console
          </a>
          <a
            href="https://www.bing.com/webmasters"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost px-4 py-2 text-sm"
          >
            Bing Webmaster
          </a>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Indexing
          </p>
          <p className="mt-1 text-lg font-semibold">
            {seo.robotsIndex ? "Public" : "No-index"}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {seo.robotsFollow ? "Follow links" : "Nofollow"}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            robots.txt
          </p>
          <a
            href={robotsUrl || "/robots.txt"}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block truncate text-sm font-medium text-accent hover:underline"
          >
            {robotsUrl || "/robots.txt"}
          </a>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            sitemap.xml
          </p>
          <a
            href={sitemapUrl || "/sitemap.xml"}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block truncate text-sm font-medium text-accent hover:underline"
          >
            {sitemapUrl || "/sitemap.xml"}
          </a>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-lg font-semibold">1 · Search listing</h2>
        <label className="block text-sm">
          <span className="font-medium">Meta title</span>
          <input
            value={seo.metaTitle}
            onChange={(e) => patch("metaTitle", e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
            maxLength={120}
          />
          <span className="mt-1 block text-[11px] text-[var(--muted)]">
            {charHint(titleLen, 40, 60)}
          </span>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Meta description</span>
          <textarea
            value={seo.metaDescription}
            onChange={(e) => patch("metaDescription", e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
            maxLength={320}
          />
          <span className="mt-1 block text-[11px] text-[var(--muted)]">
            {charHint(descLen, 120, 160)}
          </span>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Keywords</span>
          <input
            value={seo.keywords}
            onChange={(e) => patch("keywords", e.target.value)}
            placeholder="comma, separated, terms"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
            maxLength={400}
          />
          <span className="mt-1 block text-[11px] text-[var(--muted)]">
            Low ranking weight — useful for notes and legacy tools.
          </span>
        </label>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Google-style preview
          </p>
          <p className="mt-2 truncate text-lg text-[#8ab4f8]">{seo.metaTitle || "Title"}</p>
          <p className="truncate text-xs text-[#81c995]">
            {origin.replace(/^https?:\/\//, "")}
          </p>
          <p className="mt-1 line-clamp-2 text-sm text-[#bdc1c6]">
            {seo.metaDescription || "Description"}
          </p>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-lg font-semibold">2 · Social / iMessage share</h2>
        <label className="block text-sm">
          <span className="font-medium">OG title</span>
          <input
            value={seo.ogTitle}
            onChange={(e) => patch("ogTitle", e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
            maxLength={120}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">OG description</span>
          <textarea
            value={seo.ogDescription}
            onChange={(e) => patch("ogDescription", e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
            maxLength={320}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">OG image URL</span>
          <input
            value={seo.ogImageUrl}
            onChange={(e) => patch("ogImageUrl", e.target.value)}
            placeholder="/images/… or https://…"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
            maxLength={500}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">OG image alt</span>
          <input
            value={seo.ogImageAlt}
            onChange={(e) => patch("ogImageAlt", e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
            maxLength={200}
          />
        </label>
        {ogPreviewUrl ? (
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ogPreviewUrl}
              alt={seo.ogImageAlt || "OG preview"}
              className="max-h-64 w-full object-cover"
            />
            <div className="space-y-1 border-t border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
              <p className="text-sm font-semibold">{seo.ogTitle}</p>
              <p className="line-clamp-2 text-xs text-[var(--muted)]">{seo.ogDescription}</p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-lg font-semibold">3 · Robots & verification</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={seo.robotsIndex}
            onChange={(e) => patch("robotsIndex", e.target.checked)}
          />
          Allow search engines to index public pages
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={seo.robotsFollow}
            onChange={(e) => patch("robotsFollow", e.target.checked)}
          />
          Allow following links (when indexing)
        </label>
        <p className="text-xs text-[var(--muted)]">
          Always disallows <code className="text-[var(--text)]">/admin</code>,{" "}
          <code className="text-[var(--text)]">/member</code>,{" "}
          <code className="text-[var(--text)]">/api</code>, and auth routes.
        </p>
        <label className="block text-sm">
          <span className="font-medium">Google Search Console verification</span>
          <input
            value={seo.googleSiteVerification}
            onChange={(e) => patch("googleSiteVerification", e.target.value)}
            placeholder="content value only (not the full meta tag)"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
            maxLength={120}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Bing verification</span>
          <input
            value={seo.bingSiteVerification}
            onChange={(e) => patch("bingSiteVerification", e.target.value)}
            placeholder="msvalidate.01 content value"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
            maxLength={120}
          />
        </label>
      </section>

      <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-lg font-semibold">4 · Sitemap pages</h2>
        <p className="text-xs text-[var(--muted)]">
          Included when indexing is on. Add more paths in code later if needed.
        </p>
        <ul className="space-y-1 text-sm">
          {publicPaths.map((p) => (
            <li key={p.path} className="flex justify-between gap-2 font-mono text-xs">
              <span>{p.path}</span>
              <span className="text-[var(--muted)]">priority {p.priority}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="sticky bottom-3 z-10 flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)]/95 p-3 backdrop-blur sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="btn-primary px-5 py-2.5 text-sm font-semibold"
        >
          {saving ? "Saving…" : "Save SEO settings"}
        </button>
        {message ? (
          <p className="text-sm text-emerald-300">{message}</p>
        ) : error ? (
          <p className="text-sm text-rose-300">{error}</p>
        ) : (
          <p className="text-xs text-[var(--muted)]">
            Last saved: {seo.updatedAt ? new Date(seo.updatedAt).toLocaleString() : "—"}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Link href="/admin/analytics" className="btn-ghost px-3 py-2">
          Site Analytics
        </Link>
        <Link href="/admin/billing" className="btn-ghost px-3 py-2">
          Stripe money
        </Link>
        <Link href="/admin/platform" className="btn-ghost px-3 py-2">
          Platform home
        </Link>
        <Link href="/admin/landing" className="btn-ghost px-3 py-2">
          Landing
        </Link>
      </div>
    </div>
  );
}
