"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { saveHeroSlidesAction } from "@/app/admin/landing/actions";
import HeroSlideMedia from "@/components/HeroSlideMedia";
import {
  createEmptyHeroSlide,
  HERO_IMAGE_MAX_BYTES,
  HERO_PLAYBACK_RATES,
  HERO_SLIDE_MAX,
  HERO_VIDEO_MAX_BYTES,
  HERO_ZOOM_MAX,
  HERO_ZOOM_MIN,
  isHeroVideoSrc,
  objectPositionFromFocus,
  type HeroSlide,
} from "@/lib/hero-slides";
import {
  clientSiteVideoMime,
  SITE_VIDEO_CLIENT_ACCEPT,
  siteVideoExtFromMime,
} from "@/lib/site-video";

const IMAGE_MAX_MB = Math.round(HERO_IMAGE_MAX_BYTES / (1024 * 1024));
const VIDEO_MAX_MB = Math.round(HERO_VIDEO_MAX_BYTES / (1024 * 1024));

const SLOW_MO_LABELS: Record<number, string> = {
  1: "Normal speed",
  0.75: "Gentle slow",
  0.5: "Half speed",
  0.35: "Slow-mo",
  0.25: "Very slow",
};

const FILE_ACCEPT = `image/jpeg,image/png,image/webp,image/gif,image/avif,.jpg,.jpeg,.png,.webp,${SITE_VIDEO_CLIENT_ACCEPT}`;

function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/") || isHeroVideoSrc(file.name);
}

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
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function updateSlide(id: string, patch: Partial<HeroSlide>) {
    setSlides((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const next = { ...s, ...patch };
        if (patch.focusX !== undefined || patch.focusY !== undefined) {
          next.objectPosition = objectPositionFromFocus(next.focusX, next.focusY);
        }
        if (patch.src) {
          next.kind = isHeroVideoSrc(patch.src) || patch.kind === "video" ? "video" : "image";
        }
        return next;
      }),
    );
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
      setError("Keep at least one hero slide.");
      return;
    }
    if (!window.confirm("Remove this hero slide from the carousel?")) return;
    setSlides((prev) => prev.filter((s) => s.id !== id));
  }

  function addSlide() {
    if (slides.length >= HERO_SLIDE_MAX) {
      setError(`Maximum ${HERO_SLIDE_MAX} hero slides.`);
      return;
    }
    setSlides((prev) => [...prev, createEmptyHeroSlide()]);
    setMessage("New blank slide added — upload a photo or video, crop, then Save.");
  }

  async function uploadForSlide(id: string, files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploadingId(id);
    setError(null);
    setUploadProgress(null);
    try {
      const video = isVideoFile(file);
      if (video && file.size > HERO_VIDEO_MAX_BYTES) {
        throw new Error(`${file.name}: too large (max ${VIDEO_MAX_MB} MB). Export 1080p or trim.`);
      }
      if (!video && file.size > HERO_IMAGE_MAX_BYTES) {
        throw new Error(`${file.name}: too large (max ${IMAGE_MAX_MB} MB).`);
      }

      let url: string | null = null;
      if (video) {
        const mime = clientSiteVideoMime(file);
        const ext = siteVideoExtFromMime(mime);
        const pathname = `hero/${crypto.randomUUID()}.${ext}`;
        try {
          const blob = await upload(pathname, file, {
            access: "public",
            handleUploadUrl: "/api/admin/landing-media/hero-upload",
            contentType: mime,
            multipart: file.size > 4 * 1024 * 1024,
            onUploadProgress: (p) => {
              setUploadProgress(`Uploading ${file.name} (${Math.round(p.percentage)}%)`);
            },
          });
          url = blob.url;
        } catch (clientErr) {
          if (file.size > 4.5 * 1024 * 1024) throw clientErr;
        }
      }

      if (!url) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/admin/landing-media/hero-upload", {
          method: "POST",
          body: form,
        });
        const data = (await res.json().catch(() => ({}))) as {
          url?: string;
          kind?: string;
          error?: string;
        };
        if (!res.ok || !data.url) {
          throw new Error(data.error || "Upload failed");
        }
        url = data.url;
      }

      const current = slides.find((s) => s.id === id);
      updateSlide(id, {
        src: url,
        kind: video || isHeroVideoSrc(url) ? "video" : "image",
        playbackRate:
          video || isHeroVideoSrc(url)
            ? current?.kind === "video"
              ? current.playbackRate
              : 0.5
            : 1,
      });
      setMessage(
        video
          ? "Video uploaded — set crop + slow-mo, then Save hero slides."
          : "Image uploaded — adjust crop, then Save hero slides.",
      );
      setUploadProgress(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setUploadProgress(null);
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
        setMessage("Hero slides saved — live on the public landing.");
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
        <h2 className="text-lg font-semibold">Hero images &amp; videos</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Cold-traffic home carousel. Upload a photo or a phone clip, then crop (pan + zoom) and
          slow-mo. Only <strong className="text-[var(--text)]">enabled</strong> slides with a file
          show on the site. Videos play muted and loop.
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {slides.length} slide{slides.length === 1 ? "" : "s"} · {enabledCount} enabled · max{" "}
          {HERO_SLIDE_MAX} · photos {IMAGE_MAX_MB} MB · videos {VIDEO_MAX_MB} MB
        </p>
      </div>

      {uploadProgress ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
          {uploadProgress}
        </p>
      ) : null}

      <ul className="space-y-4">
        {slides.map((slide, index) => {
          const isVideo = slide.kind === "video" || isHeroVideoSrc(slide.src);
          return (
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
                      <HeroSlideMedia
                        slide={slide}
                        active
                        className="h-full w-full object-cover"
                        alt={slide.alt || `Hero ${index + 1}`}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-2 text-center text-xs text-[var(--muted)]">
                        No file yet
                      </div>
                    )}
                    <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                      #{index + 1}
                      {isVideo ? " · video" : ""}
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

                  <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/40 p-3">
                    <p className="text-sm font-medium">Crop</p>
                    <p className="text-[11px] text-[var(--muted)]">
                      Pan until the face/action sits in the tall phone frame, then zoom in.
                    </p>
                    <label className="block text-xs">
                      Left / right ({Math.round(slide.focusX)}%)
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={slide.focusX}
                        onChange={(e) =>
                          updateSlide(slide.id, { focusX: Number(e.target.value) })
                        }
                        className="mt-1 w-full"
                      />
                    </label>
                    <label className="block text-xs">
                      Up / down ({Math.round(slide.focusY)}%)
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={slide.focusY}
                        onChange={(e) =>
                          updateSlide(slide.id, { focusY: Number(e.target.value) })
                        }
                        className="mt-1 w-full"
                      />
                    </label>
                    <label className="block text-xs">
                      Zoom ({slide.zoom.toFixed(2)}×)
                      <input
                        type="range"
                        min={HERO_ZOOM_MIN}
                        max={HERO_ZOOM_MAX}
                        step={0.05}
                        value={slide.zoom}
                        onChange={(e) =>
                          updateSlide(slide.id, { zoom: Number(e.target.value) })
                        }
                        className="mt-1 w-full"
                      />
                    </label>
                  </div>

                  {isVideo ? (
                    <label className="block text-sm">
                      <span className="font-medium">Slow motion</span>
                      <select
                        value={String(slide.playbackRate)}
                        onChange={(e) =>
                          updateSlide(slide.id, { playbackRate: Number(e.target.value) })
                        }
                        className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
                      >
                        {HERO_PLAYBACK_RATES.map((rate) => (
                          <option key={rate} value={rate}>
                            {SLOW_MO_LABELS[rate] || `${rate}×`}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] text-[var(--muted)]">
                        Plays muted on the landing. Half speed is the usual slow-mo.
                      </p>
                    </label>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={(el) => {
                        fileRefs.current[slide.id] = el;
                      }}
                      type="file"
                      accept={FILE_ACCEPT}
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
                          ? "Replace photo or video"
                          : "Upload photo or video"}
                    </button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-ghost px-4 py-2 text-sm font-semibold"
          disabled={slides.length >= HERO_SLIDE_MAX}
          onClick={addSlide}
        >
          + Add hero slide
        </button>
        <button
          type="button"
          className="btn-primary px-5 py-2.5 text-sm font-semibold"
          disabled={saving || Boolean(uploadingId)}
          onClick={() => void handleSave()}
        >
          {saving ? "Saving…" : "Save hero slides"}
        </button>
      </div>

      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </section>
  );
}
