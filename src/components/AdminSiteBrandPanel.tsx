"use client";

import { useState } from "react";
import { saveSiteBrandAction } from "@/app/admin/landing/actions";
import AdminLogoEditor from "@/components/AdminLogoEditor";
import type { LogoTransform } from "@/lib/logo-transform";
import { DEFAULT_LOGO_TRANSFORM } from "@/lib/logo-transform";
import type { ResolvedSiteBrand } from "@/lib/site-brand";

export default function AdminSiteBrandPanel({
  initialBrandName = "",
  initialBrandTagline = "",
  initialLogoUrl = "",
  initialLogoIconUrl = "",
  initialFaviconUrl = "",
  initialLogoSourceUrl = "",
  initialLogoTransform = DEFAULT_LOGO_TRANSFORM,
  resolvedLogoUrl = "",
  resolvedLogoIconUrl = "",
  resolvedFaviconUrl = "",
}: {
  initialBrandName?: string;
  initialBrandTagline?: string;
  initialLogoUrl?: string;
  initialLogoIconUrl?: string;
  initialFaviconUrl?: string;
  initialLogoSourceUrl?: string;
  initialLogoTransform?: LogoTransform;
  resolvedLogoUrl?: string;
  resolvedLogoIconUrl?: string;
  resolvedFaviconUrl?: string;
}) {
  const [brandName, setBrandName] = useState(initialBrandName);
  const [brandTagline, setBrandTagline] = useState(initialBrandTagline);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [logoIconUrl, setLogoIconUrl] = useState(initialLogoIconUrl);
  const [faviconUrl, setFaviconUrl] = useState(initialFaviconUrl);
  const [logoSourceUrl, setLogoSourceUrl] = useState(
    initialLogoSourceUrl || "/images/logo-source.png",
  );
  const [logoTransform, setLogoTransform] = useState<LogoTransform>(initialLogoTransform);
  const [preview, setPreview] = useState({
    logoUrl: resolvedLogoUrl,
    logoIconUrl: resolvedLogoIconUrl,
    faviconUrl: resolvedFaviconUrl,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setError(false);

    const result = await saveSiteBrandAction({
      brandName: brandName.trim(),
      brandTagline: brandTagline.trim(),
      logoUrl: logoUrl.trim() || null,
      logoIconUrl: logoIconUrl.trim() || null,
      faviconUrl: faviconUrl.trim() || null,
      logoSourceUrl: logoSourceUrl.trim() || null,
      logoTransform,
    });

    if ("error" in result && result.error) {
      setError(true);
      setMessage(result.error);
    } else if ("ok" in result && result.ok) {
      setBrandName(result.storedBrandName || "");
      setBrandTagline(result.storedBrandTagline || "");
      setLogoUrl(result.storedLogoUrl || "");
      setLogoIconUrl(result.storedLogoIconUrl || "");
      setFaviconUrl(result.storedFaviconUrl || "");
      if (result.storedLogoSourceUrl) setLogoSourceUrl(result.storedLogoSourceUrl);
      if (result.logoTransform) setLogoTransform(result.logoTransform);
      setPreview({
        logoUrl: result.logoUrl,
        logoIconUrl: result.logoIconUrl,
        faviconUrl: result.faviconUrl,
      });
      setMessage("Brand text saved.");
      setError(false);
    } else {
      setError(true);
      setMessage("Save failed");
    }

    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#7c3aed]/30 bg-[#7c3aed]/5 p-4 text-sm text-[var(--accent-fg)]">
        <p className="font-semibold text-[var(--text)]">White-label brand</p>
        <p className="mt-2 text-[var(--muted)]">
          Use a transparent PNG for the cleanest result. The editor preserves alpha through zoom,
          crop, and rotation — then publishes optimized site logos.
        </p>
      </div>

      <AdminLogoEditor
        sourceUrl={logoSourceUrl}
        initialTransform={logoTransform}
        onPublished={(result) => {
          setLogoUrl(result.logoUrl);
          setLogoIconUrl(result.logoIconUrl);
          setFaviconUrl(result.faviconUrl);
          setLogoTransform(result.logoTransform);
          if (result.logoSourceUrl) setLogoSourceUrl(result.logoSourceUrl);
          setPreview({
            logoUrl: result.logoUrl,
            logoIconUrl: result.logoIconUrl,
            faviconUrl: result.faviconUrl,
          });
        }}
      />

      <div className="card space-y-4">
        <p className="text-sm font-semibold text-[var(--text)]">Published sizes</p>
        <div className="flex flex-wrap gap-4">
          <PreviewTile label="Header" url={preview.logoUrl} />
          <PreviewTile label="Icon" url={preview.logoIconUrl} small />
          <PreviewTile label="Favicon" url={preview.faviconUrl} small />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            id="brand-name"
            label="Brand name"
            value={brandName}
            onChange={setBrandName}
            placeholder="The Train Station"
          />
          <Field
            id="brand-tagline"
            label="Tagline"
            value={brandTagline}
            onChange={setBrandTagline}
            placeholder="Professional training programs…"
          />
        </div>

        <details className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/40 p-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-[#7c3aed]">
            Advanced URLs (optional)
          </summary>
          <div className="mt-3 space-y-3">
            <Field
              id="logo-source-url"
              label="Logo source URL"
              value={logoSourceUrl}
              onChange={setLogoSourceUrl}
              placeholder="/images/logo-source.png"
            />
            <Field
              id="logo-url"
              label="Logo URL override"
              value={logoUrl}
              onChange={setLogoUrl}
              placeholder="/images/logo.png or https://…"
            />
            <Field
              id="logo-icon-url"
              label="Icon URL override"
              value={logoIconUrl}
              onChange={setLogoIconUrl}
              placeholder="/images/logo-icon.png"
            />
            <Field
              id="favicon-url"
              label="Favicon URL override"
              value={faviconUrl}
              onChange={setFaviconUrl}
              placeholder="/favicon.png"
            />
          </div>
        </details>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex h-11 items-center justify-center rounded-full bg-[#7c3aed] px-8 text-sm font-semibold text-[var(--text)] hover:bg-[#6d2dd6] disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save brand text"}
        </button>
        <a href="/" target="_blank" rel="noopener noreferrer" className="text-sm text-[#7c3aed] hover:underline">
          Preview home page ↗
        </a>
      </div>

      {message && (
        <p className={`text-sm ${error ? "text-amber-400" : "text-emerald-400"}`}>{message}</p>
      )}
    </div>
  );
}

function PreviewTile({
  label,
  url,
  small = false,
}: {
  label: string;
  url: string;
  small?: boolean;
}) {
  const checkerboard =
    "repeating-conic-gradient(#3d2660 0% 25%, #1a1028 0% 50%) 50% / 12px 12px";
  return (
    <div className="text-center">
      <div
        className={`mx-auto flex items-center justify-center overflow-hidden rounded-xl ring-1 ring-[var(--border)] ${
          small ? "h-14 w-14" : "h-20 w-32"
        }`}
        style={{ background: checkerboard }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`${label} preview`} className="h-full w-full object-contain p-1" />
        ) : (
          <span className="text-[10px] text-[var(--muted)]">—</span>
        )}
      </div>
      <p className="mt-1 text-[10px] text-[var(--muted)]">{label}</p>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-[var(--muted)]">
        {label}
      </label>
      <input
        id={id}
        className="input mt-1 w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}