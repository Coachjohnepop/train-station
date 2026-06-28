"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_LOGO_TRANSFORM,
  type LogoTransform,
} from "@/lib/logo-transform";

const CHECKERBOARD =
  "repeating-conic-gradient(#3d2660 0% 25%, #1a1028 0% 50%) 50% / 20px 20px";

type AdminLogoEditorProps = {
  sourceUrl: string;
  initialTransform?: LogoTransform;
  onPublished: (result: {
    logoUrl: string;
    logoIconUrl: string;
    faviconUrl: string;
    logoTransform: LogoTransform;
    logoSourceUrl?: string | null;
  }) => void;
};

export default function AdminLogoEditor({
  sourceUrl,
  initialTransform = DEFAULT_LOGO_TRANSFORM,
  onPublished,
}: AdminLogoEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [transform, setTransform] = useState<LogoTransform>(initialTransform);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [liveSource, setLiveSource] = useState(sourceUrl);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const refreshPreview = useCallback(async (next: LogoTransform) => {
    try {
      const res = await fetch("/api/admin/site-brand/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const body = await res.json();
      if (!res.ok || body.error) return;
      setPreviewUrl(body.previewUrl || null);
    } catch {
      /* preview is best-effort */
    }
  }, []);

  useEffect(() => {
    setLiveSource(sourceUrl);
  }, [sourceUrl]);

  useEffect(() => {
    setTransform(initialTransform);
  }, [initialTransform]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshPreview(transform);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [transform, liveSource, refreshPreview]);

  function update<K extends keyof LogoTransform>(key: K, value: LogoTransform[K]) {
    setTransform((prev) => ({ ...prev, [key]: value }));
  }

  async function handleUpload(file: File) {
    setBusy(true);
    setMessage(null);
    setError(false);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/admin/site-brand/upload", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok || body.error) {
        setError(true);
        setMessage(body.error || "Upload failed");
        return;
      }
      const reset = body.logoTransform || DEFAULT_LOGO_TRANSFORM;
      setTransform(reset);
      if (body.storedLogoSourceUrl) setLiveSource(body.storedLogoSourceUrl);
      onPublished({
        logoUrl: body.logoUrl,
        logoIconUrl: body.logoIconUrl,
        faviconUrl: body.faviconUrl,
        logoTransform: reset,
        logoSourceUrl: body.storedLogoSourceUrl,
      });
      setMessage("Source uploaded — adjust zoom, crop, and rotation, then publish.");
      setError(false);
    } catch {
      setError(true);
      setMessage("Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handlePublish() {
    setBusy(true);
    setMessage(null);
    setError(false);
    try {
      const res = await fetch("/api/admin/site-brand/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transform),
      });
      const body = await res.json();
      if (!res.ok || body.error) {
        setError(true);
        setMessage(body.error || "Publish failed");
        return;
      }
      onPublished({
        logoUrl: body.logoUrl,
        logoIconUrl: body.logoIconUrl,
        faviconUrl: body.faviconUrl,
        logoTransform: body.logoTransform,
        logoSourceUrl: body.storedLogoSourceUrl,
      });
      setMessage("Logo published — transparent PNGs are live across the site.");
      setError(false);
    } catch {
      setError(true);
      setMessage("Publish failed");
    } finally {
      setBusy(false);
    }
  }

  function handleReset() {
    setTransform({ ...DEFAULT_LOGO_TRANSFORM });
  }

  const cssPreview = {
    transform: `rotate(${transform.rotation}deg) scale(${transform.scale}) translate(${transform.offsetX}%, ${transform.offsetY}%)`,
  };

  return (
    <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/50 p-4">
      <div>
        <p className="text-sm font-semibold text-white">Logo editor</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Checkerboard = transparency. Zoom, crop, rotate, then publish optimized PNGs for nav,
          hero, and favicon.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div
          className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl ring-1 ring-[#3d2660]"
          style={{ background: CHECKERBOARD }}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Server preview"
              className="max-h-[92%] max-w-[92%] object-contain"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={liveSource}
              alt="Logo live preview"
              className="max-h-[78%] max-w-[78%] object-contain transition-transform duration-150"
              style={cssPreview}
            />
          )}
          <span className="absolute bottom-2 right-2 rounded bg-black/50 px-2 py-0.5 text-[10px] text-white/80">
            {previewUrl ? "Server preview" : "Live preview"}
          </span>
        </div>

        <div className="space-y-4">
          <Slider
            label="Zoom"
            hint="Scale the logo within the frame"
            min={40}
            max={200}
            step={1}
            value={Math.round(transform.scale * 100)}
            display={`${Math.round(transform.scale * 100)}%`}
            onChange={(v) => update("scale", v / 100)}
          />
          <Slider
            label="Rotation"
            hint="Rotate in degrees"
            min={-180}
            max={180}
            step={1}
            value={transform.rotation}
            display={`${transform.rotation}°`}
            onChange={(v) => update("rotation", v)}
          />
          <Slider
            label="Pan left / right"
            hint="Reposition horizontally"
            min={-50}
            max={50}
            step={1}
            value={transform.offsetX}
            display={`${transform.offsetX}%`}
            onChange={(v) => update("offsetX", v)}
          />
          <Slider
            label="Pan up / down"
            hint="Reposition vertically"
            min={-50}
            max={50}
            step={1}
            value={transform.offsetY}
            display={`${transform.offsetY}%`}
            onChange={(v) => update("offsetY", v)}
          />
          <Slider
            label="Crop inset"
            hint="Tighten framing by trimming edges"
            min={0}
            max={35}
            step={1}
            value={transform.cropInset}
            display={`${transform.cropInset}%`}
            onChange={(v) => update("cropInset", v)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
          }}
        />
        <button
          type="button"
          className="btn-secondary text-sm"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          Upload new source
        </button>
        <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={handleReset}>
          Reset controls
        </button>
        <button
          type="button"
          className="btn-primary text-sm"
          disabled={busy}
          onClick={() => void handlePublish()}
        >
          {busy ? "Working…" : "Publish logo"}
        </button>
      </div>

      {message && (
        <p className={`text-sm ${error ? "text-amber-400" : "text-emerald-400"}`}>{message}</p>
      )}
    </div>
  );
}

function Slider({
  label,
  hint,
  min,
  max,
  step,
  value,
  display,
  onChange,
}: {
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  value: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-white">{label}</label>
        <span className="text-xs text-[#7c3aed]">{display}</span>
      </div>
      <p className="text-[10px] text-[var(--muted)]">{hint}</p>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[#7c3aed]"
      />
    </div>
  );
}