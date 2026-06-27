"use client";

import { useRef, useState } from "react";
import { saveSiteBrandAction } from "@/app/admin/landing/actions";
import type { ResolvedSiteBrand } from "@/lib/site-brand";

export default function AdminSiteBrandPanel({
  initialBrandName = "",
  initialBrandTagline = "",
  initialLogoUrl = "",
  initialLogoIconUrl = "",
  initialFaviconUrl = "",
  resolvedLogoUrl = "",
  resolvedLogoIconUrl = "",
  resolvedFaviconUrl = "",
}: {
  initialBrandName?: string;
  initialBrandTagline?: string;
  initialLogoUrl?: string;
  initialLogoIconUrl?: string;
  initialFaviconUrl?: string;
  resolvedLogoUrl?: string;
  resolvedLogoIconUrl?: string;
  resolvedFaviconUrl?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [brandName, setBrandName] = useState(initialBrandName);
  const [brandTagline, setBrandTagline] = useState(initialBrandTagline);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [logoIconUrl, setLogoIconUrl] = useState(initialLogoIconUrl);
  const [faviconUrl, setFaviconUrl] = useState(initialFaviconUrl);
  const [preview, setPreview] = useState({
    logoUrl: resolvedLogoUrl,
    logoIconUrl: resolvedLogoIconUrl,
    faviconUrl: resolvedFaviconUrl,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
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
      setPreview({
        logoUrl: result.logoUrl,
        logoIconUrl: result.logoIconUrl,
        faviconUrl: result.faviconUrl,
      });
      setMessage("Brand saved — live across the site now.");
      setError(false);
    } else {
      setError(true);
      setMessage("Save failed");
    }

    setSaving(false);
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setMessage(null);
    setError(false);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/admin/site-brand/upload", {
        method: "POST",
        body: form,
      });
      const body = (await res.json()) as ResolvedSiteBrand & {
        ok?: boolean;
        error?: string;
        storedLogoUrl?: string | null;
        storedLogoIconUrl?: string | null;
        storedFaviconUrl?: string | null;
      };

      if (!res.ok || body.error) {
        setError(true);
        setMessage(body.error || "Upload failed");
        return;
      }

      setLogoUrl(body.storedLogoUrl || "");
      setLogoIconUrl(body.storedLogoIconUrl || "");
      setFaviconUrl(body.storedFaviconUrl || "");
      setPreview({
        logoUrl: body.logoUrl,
        logoIconUrl: body.logoIconUrl,
        faviconUrl: body.faviconUrl,
      });
      setMessage("Logo uploaded and optimized — header, hero, and favicon updated.");
      setError(false);
    } catch {
      setError(true);
      setMessage("Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#7c3aed]/30 bg-[#7c3aed]/5 p-4 text-sm text-[#c4b5fd]">
        <p className="font-semibold text-white">White-label brand</p>
        <p className="mt-2 text-[#9d8ab8]">
          Upload your main logo once — we generate optimized PNGs for the nav, hero, and favicon.
          Display sizes scale with the page; files stay small for fast loads. Clear the URL fields
          and save to fall back to the built-in defaults.
        </p>
      </div>

      <div className="card space-y-4">
        <div>
          <p className="text-sm font-semibold text-white">Site logo</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            PNG or JPEG recommended. Square or circular emblems work best.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-black/40 ring-1 ring-[#3d2660]">
            {preview.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.logoUrl} alt="Logo preview" className="h-full w-full object-contain" />
            ) : (
              <span className="text-xs text-[var(--muted)]">No logo</span>
            )}
          </div>
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="block text-xs text-[var(--muted)] file:mr-3 file:rounded-full file:border-0 file:bg-[#7c3aed] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[#6d2dd6]"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
              }}
            />
            <p className="text-[10px] text-[var(--muted)]">
              {uploading ? "Optimizing and uploading…" : "Max 8 MB · auto-resized to 480px, 128px, and 32px"}
            </p>
          </div>
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
          disabled={saving || uploading}
          className="inline-flex h-11 items-center justify-center rounded-full bg-[#7c3aed] px-8 text-sm font-semibold text-white hover:bg-[#6d2dd6] disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save brand"}
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