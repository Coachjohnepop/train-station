"use client";

import { useRef, useState } from "react";
import { saveHeroSlidesAction } from "@/app/admin/landing/actions";
import {
  createEmptyHeroSlide,
  HERO_IMAGE_MAX_BYTES,
  HERO_SLIDE_MAX,
  type HeroSlide,
} from "@/lib/hero-slides";

const MAX_MB = Math.round(HERO_IMAGE_MAX_BYTES / (1024 * 1024));

const OBJECT_PRESETS = [
  { label: "Center top (phones)", value: "center 22%" },
  { label: "Center", value: "center center" },
  { label: "Top", value: "center top" },
  { label: "Bottom", value: "center bottom" },
  { label: "Left", value: "left center" },
  { label: "Right", value: "right center" },
];

export default function AdminHeroImagesPanel({
  initialSlides,
}: {
  initialSlides: HeroSlide[];
}) {
  const [slides, setSlides] = useState<HeroSlide[]>(() =>
    initialSlides.length ? initialSlides.map((s) => ({ ...s })) : [],
  );
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function updateSlide(id: string, patch: Partial<HeroSlide>) {
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function moveSlide(id: string, dir: -1 | 1) {
    setSlides((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function removeSlide(id: string) {
    if (slides.length <= 1) {
      setError("Keep at least one hero image.");
      return;
    }
    if (!window.confirm("Remove this hero image from the carousel?")) return;
    setSlides((prev) => prev.filter((s) => s.id !== id));
  }

  function addSlide() {
    if (slides.length >= HERO_SLIDE_MAX) {
      setError(`Maximum ${HERO_SLIDE_MAX} hero images.`);
      return;
    }
    const slide = createEmptyHeroSlide();
    setSlides((prev) => [...prev, slide]);
    setMessage("New blank slide added — upload an image, then Save.");
  }

  async function uploadForSlide(id: string, files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploadingId(id);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/landing-media/hero-upload", {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Upload failed");
      }
      updateSlide(id, { src: data.url });
      setMessage("Image uploaded — click Save hero images to publish.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingId(null);
      const input = fileRefs.current[id];
      if (input) input.value = "";
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await saveHeroSlidesAction(slides);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if ("ok" in result && result.ok && result.storedHeroSlides) {
        setSlides(result.storedHeroSlides.map((s) => ({ ...s })));
        setMessage("Hero images saved — live on the public landing carousel.");
      }
    } catch {
      setError("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const enabledCount = slides.filter((s) => s.enabled && s.src).length;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Hero images</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Cold-traffic home carousel (the full-screen athlete photos). Edit each slide, upload
          replacements, reorder, or add more than four. Only <strong className="text-[var(--text)]">enabled</strong>{" "}
          slides with an image show on the site.
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {slides.length} slide{slides.length === 1 ? "" : "s"} · {enabledCount} enabled · max{" "}
          {HERO_SLIDE_MAX} · JPEG/PNG/WebP up to {MAX_MB} MB
        </p>
      </div>

      <ul className="space-y-4">
        {slides.map((slide, index) => (
          <li
            key={slide.id}
            className={`rounded-2xl border p-4 ${
              slide.enabled
                ? "border-[var(--border)] bg-[var(--surface)]"
                : "border-dashed border-[var(--border)] bg-[var(--surface-2)]/50 opacity-80"
            }`}
          >
            <div className="flex flex-wrap items-start gap-4">
              <div className="w-full max-w-[11rem] shrink-0">
                <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-[var(--border)] bg-black">
                  {slide.src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={slide.src}
                      alt={slide.alt || `Hero ${index + 1}`}
                      className="h-full w-full object-cover"
                      style={{ objectPosition: slide.objectPosition || "center 22%" }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-2 text-center text-xs text-[var(--muted)]">
                      No image yet
                    </div>
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                    #{index + 1}
                  </span>
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={slide.enabled}
                      onChange={(e) => updateSlide(slide.id, { enabled: e.target.checked })}
                    />
                    Enabled on site
                  </label>
                  <div className="ml-auto flex flex-wrap gap-1">
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1 text-xs"
                      disabled={index === 0}
                      onClick={() => moveSlide(slide.id, -1)}
                    >
                      ↑ Up
                    </button>
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1 text-xs"
                      disabled={index === slides.length - 1}
                      onClick={() => moveSlide(slide.id, 1)}
                    >
                      ↓ Down
                    </button>
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1 text-xs text-rose-300"
                      onClick={() => removeSlide(slide.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <label className="block text-sm">
                  <span className="font-medium">Alt text</span>
                  <input
                    value={slide.alt}
                    onChange={(e) => updateSlide(slide.id, { alt: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
                    maxLength={200}
                    placeholder="Describe the athlete / action"
                  />
                </label>

                <label className="block text-sm">
                  <span className="font-medium">Crop framing (object-position)</span>
                  <select
                    value={
                      OBJECT_PRESETS.some((p) => p.value === slide.objectPosition)
                        ? slide.objectPosition
                        : "__custom__"
                    }
                    onChange={(e) => {
                      if (e.target.value === "__custom__") return;
                      updateSlide(slide.id, { objectPosition: e.target.value });
                    }}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
                  >
                    {OBJECT_PRESETS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                    <option value="__custom__">Custom (edit below)</option>
                  </select>
                  <input
                    value={slide.objectPosition}
                    onChange={(e) => updateSlide(slide.id, { objectPosition: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 font-mono text-xs"
                    placeholder="center 22%"
                  />
                </label>

                <label className="block text-sm">
                  <span className="font-medium">Image URL</span>
                  <input
                    value={slide.src}
                    onChange={(e) => updateSlide(slide.id, { src: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 font-mono text-xs"
                    placeholder="/images/splash/… or https://…"
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <input
                    ref={(el) => {
                      fileRefs.current[slide.id] = el;
                    }}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/avif,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={(e) => void uploadForSlide(slide.id, e.target.files)}
                  />
                  <button
                    type="button"
                    className="btn-primary px-3 py-1.5 text-xs font-semibold"
                    disabled={uploadingId === slide.id}
                    onClick={() => fileRefs.current[slide.id]?.click()}
                  >
                    {uploadingId === slide.id
                      ? "Uploading…"
                      : slide.src
                        ? "Replace image"
                        : "Upload image"}
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-ghost px-4 py-2 text-sm font-semibold"
          disabled={slides.length >= HERO_SLIDE_MAX}
          onClick={addSlide}
        >
          + Add hero image
        </button>
        <button
          type="button"
          className="btn-primary px-5 py-2.5 text-sm font-semibold"
          disabled={saving || Boolean(uploadingId)}
          onClick={() => void handleSave()}
        >
          {saving ? "Saving…" : "Save hero images"}
        </button>
      </div>

      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </section>
  );
}
