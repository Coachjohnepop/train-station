"use client";

import { useRef, useState, type PointerEvent } from "react";
import { upload } from "@vercel/blob/client";
import { saveHeroSlidesAction } from "@/app/admin/landing/actions";
import HeroSlideMedia from "@/components/HeroSlideMedia";
import {
  createEmptyHeroSlide,
  formatHeroTime,
  HERO_IMAGE_MAX_BYTES,
  HERO_MIN_TRIM_SEC,
  HERO_PLAYBACK_RATES,
  HERO_SLIDE_MAX,
  HERO_VIDEO_MAX_BYTES,
  HERO_ZOOM_MAX,
  HERO_ZOOM_MIN,
  heroTrimDurationSec,
  heroTrimWindow,
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
  const [durations, setDurations] = useState<Record<string, number>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const dragIdRef = useRef<string | null>(null);
  const orderStripRef = useRef<HTMLDivElement | null>(null);
  const slidesRef = useRef(slides);
  slidesRef.current = slides;
  const persistBusyRef = useRef(false);
  const persistAgainRef = useRef(false);
  const persistMessageRef = useRef("Hero slides saved — live on the public landing.");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  function arrayMove(list: HeroSlide[], from: number, to: number): HeroSlide[] {
    if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
      return list;
    }
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  }

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

  async function persistSlides(next: HeroSlide[], okMessage: string) {
    slidesRef.current = next;
    persistMessageRef.current = okMessage;
    if (persistBusyRef.current) {
      persistAgainRef.current = true;
      return;
    }
    persistBusyRef.current = true;
    setSaving(true);
    setError(null);
    try {
      do {
        persistAgainRef.current = false;
        const payload = slidesRef.current.map((s) => ({ ...s }));
        const result = await saveHeroSlidesAction(payload);
        if (persistAgainRef.current) continue;
        if ("error" in result && result.error) {
          setError(result.error);
          return;
        }
        if ("ok" in result && result.ok && result.storedHeroSlides) {
          setMessage(persistMessageRef.current);
          if (!persistAgainRef.current) {
            const stored = result.storedHeroSlides.map((s) => ({ ...s }));
            slidesRef.current = stored;
            setSlides(stored);
          }
        }
      } while (persistAgainRef.current);
    } catch {
      setError("Save failed.");
    } finally {
      persistBusyRef.current = false;
      setSaving(false);
    }
    if (persistAgainRef.current) {
      void persistSlides(slidesRef.current, persistMessageRef.current);
    }
  }

  function applyOrder(next: HeroSlide[]) {
    slidesRef.current = next;
    setSlides(next);
    void persistSlides(next, "Play order saved — live on the landing.");
  }

  function moveSlide(id: string, dir: -1 | 1 | "first") {
    const list = slidesRef.current;
    const i = list.findIndex((s) => s.id === id);
    if (i < 0) return;
    const j = dir === "first" ? 0 : i + dir;
    if (j < 0 || j >= list.length || j === i) return;
    applyOrder(arrayMove(list, i, j));
  }

  function moveSlideTo(id: string, toIndex: number) {
    const list = slidesRef.current;
    const i = list.findIndex((s) => s.id === id);
    if (i < 0) return;
    applyOrder(arrayMove(list, i, toIndex));
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
        trimStartSec: 0,
        trimEndSec: null,
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
    setMessage(null);
    await persistSlides(slidesRef.current, "Hero slides saved — live on the public landing.");
  }

  function thumbIndexFromClientX(clientX: number): number | null {
    const strip = orderStripRef.current;
    if (!strip) return null;
    const thumbs = [...strip.querySelectorAll<HTMLElement>("[data-hero-order-id]")];
    if (!thumbs.length) return null;
    let best = 0;
    let bestDist = Infinity;
    thumbs.forEach((el, idx) => {
      const r = el.getBoundingClientRect();
      const mid = r.left + r.width / 2;
      const dist = Math.abs(clientX - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = idx;
      }
    });
    return best;
  }

  function onOrderPointerDown(id: string, e: PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    dragIdRef.current = id;
    setDraggingId(id);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onOrderPointerMove(e: PointerEvent<HTMLButtonElement>) {
    const id = dragIdRef.current;
    if (!id) return;
    const to = thumbIndexFromClientX(e.clientX);
    if (to == null) return;
    setSlides((prev) => {
      const from = prev.findIndex((s) => s.id === id);
      if (from < 0 || from === to) return prev;
      const next = arrayMove(prev, from, to);
      slidesRef.current = next;
      return next;
    });
  }

  function onOrderPointerUp() {
    if (!dragIdRef.current) return;
    dragIdRef.current = null;
    setDraggingId(null);
    void persistSlides(slidesRef.current, "Play order saved — live on the landing.");
  }

  const enabledCount = slides.filter((s) => s.enabled && s.src).length;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Hero images &amp; videos</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Cold-traffic home carousel. Drag the play-order strip (or use Earlier / Later) to change
          which clip leads — order saves live. Video cards stay still until you tap preview so the
          page can open on a phone. Upload a photo or a phone clip, then use the{" "}
          <strong className="text-[var(--text)]">Trim</strong>,{" "}
          <strong className="text-[var(--text)]">Crop</strong>, and{" "}
          <strong className="text-[var(--text)]">Slow motion</strong> levers. Only enabled slides
          with a file show on the site. Videos play muted and loop the trimmed range.
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {slides.length} slide{slides.length === 1 ? "" : "s"} · {enabledCount} enabled · max{" "}
          {HERO_SLIDE_MAX} · photos {IMAGE_MAX_MB} MB · videos {VIDEO_MAX_MB} MB
        </p>
      </div>

      {slides.length > 1 ? (
        <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-sm font-semibold">Play order</p>
          <p className="text-[11px] text-[var(--muted)]">
            #1 is the first thing cold traffic sees. Drag a tile, or pick a slot on a card.
            Reorder saves to the live landing.
          </p>
          <div
            ref={orderStripRef}
            className="flex gap-2 overflow-x-auto pb-1"
          >
            {slides.map((slide, index) => {
              const videoThumb = slide.kind === "video" || isHeroVideoSrc(slide.src);
              return (
                <button
                  key={slide.id}
                  type="button"
                  data-hero-order-id={slide.id}
                  aria-label={`Slide ${index + 1}${slide.enabled ? "" : " (off)"}. Drag to reorder.`}
                  className={`relative h-24 w-[4.25rem] shrink-0 overflow-hidden rounded-lg border text-left ${
                    draggingId === slide.id
                      ? "border-[#d4af37] ring-2 ring-[#d4af37]/60"
                      : slide.enabled
                        ? "border-[var(--border)]"
                        : "border-dashed border-[var(--border)] opacity-70"
                  }`}
                  style={{ touchAction: "none" }}
                  onPointerDown={(e) => onOrderPointerDown(slide.id, e)}
                  onPointerMove={onOrderPointerMove}
                  onPointerUp={onOrderPointerUp}
                  onPointerCancel={onOrderPointerUp}
                >
                  {slide.src && !videoThumb ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={slide.src} alt="" className="h-full w-full object-cover" draggable={false} />
                  ) : (
                    <span
                      className={`flex h-full w-full items-center justify-center px-1 text-center text-[10px] font-semibold ${
                        videoThumb ? "bg-black text-white" : "bg-[var(--surface-2)] text-[var(--muted)]"
                      }`}
                    >
                      {slide.src ? "Video" : "Empty"}
                    </span>
                  )}
                  <span className="absolute left-1 top-1 rounded-full bg-black/75 px-1.5 text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                  {!slide.enabled ? (
                    <span className="absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-center text-[9px] font-semibold text-white">
                      Off
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

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
                <div className="w-full max-w-[14rem] shrink-0">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-[var(--border)] bg-black">
                    {slide.src ? (
                      isVideo && previewId !== slide.id ? (
                        <button
                          type="button"
                          className="flex h-full w-full flex-col items-center justify-center gap-1 bg-black px-2 text-center text-xs font-semibold text-white"
                          onClick={() => setPreviewId(slide.id)}
                        >
                          <span>Tap to preview</span>
                          <span className="text-[10px] font-normal text-white/70">
                            Skips loading this clip until you ask
                          </span>
                        </button>
                      ) : (
                        <HeroSlideMedia
                          slide={slide}
                          active={previewId === slide.id || !isVideo}
                          className="h-full w-full object-cover"
                          alt={slide.alt || `Hero ${index + 1}`}
                          onDuration={(seconds) => {
                            setDurations((prev) =>
                              prev[slide.id] === seconds ? prev : { ...prev, [slide.id]: seconds },
                            );
                          }}
                        />
                      )
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
                    <div className="ml-auto flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-ghost min-h-11 px-3 py-2 text-sm font-semibold"
                        disabled={index === 0}
                        onClick={() => moveSlide(slide.id, -1)}
                      >
                        ← Earlier
                      </button>
                      <button
                        type="button"
                        className="btn-ghost min-h-11 px-3 py-2 text-sm font-semibold"
                        disabled={index === slides.length - 1}
                        onClick={() => moveSlide(slide.id, 1)}
                      >
                        Later →
                      </button>
                      {index > 0 ? (
                        <button
                          type="button"
                          className="btn-ghost min-h-11 px-3 py-2 text-sm font-semibold"
                          onClick={() => moveSlide(slide.id, "first")}
                        >
                          Play first
                        </button>
                      ) : null}
                      <label className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm">
                        Play as
                        <select
                          className="bg-transparent font-semibold"
                          value={index}
                          onChange={(e) => moveSlideTo(slide.id, Number(e.target.value))}
                          aria-label={`Play slide as position`}
                        >
                          {slides.map((_, i) => (
                            <option key={i} value={i}>
                              #{i + 1}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="btn-ghost min-h-11 px-3 py-2 text-sm font-semibold text-rose-300"
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

                  {isVideo ? (
                    <div className="space-y-2 rounded-xl border border-violet-500/25 bg-violet-500/5 p-3">
                      <p className="text-sm font-semibold text-violet-100">1 · Trim</p>
                      <p className="text-[11px] text-[var(--muted)]">
                        Keep only the beat you want. The landing loops this range.
                      </p>
                      {(() => {
                        const duration = durations[slide.id] || 0;
                        const max = duration > 0 ? duration : Math.max(slide.trimEndSec || 30, slide.trimStartSec + 8);
                        const window = heroTrimWindow(slide, duration || null);
                        const kept = heroTrimDurationSec(slide, duration || null);
                        const endValue = window.end ?? max;
                        return (
                          <>
                            <label className="block text-xs">
                              Start ({formatHeroTime(window.start)})
                              <input
                                type="range"
                                min={0}
                                max={Math.max(0.1, max - HERO_MIN_TRIM_SEC)}
                                step={0.1}
                                value={window.start}
                                onChange={(e) =>
                                  updateSlide(slide.id, { trimStartSec: Number(e.target.value) })
                                }
                                className="mt-1 w-full"
                              />
                            </label>
                            <label className="block text-xs">
                              End ({window.end == null && !duration ? "end of file" : formatHeroTime(endValue)})
                              <input
                                type="range"
                                min={Math.min(max, window.start + HERO_MIN_TRIM_SEC)}
                                max={max}
                                step={0.1}
                                value={endValue}
                                onChange={(e) =>
                                  updateSlide(slide.id, { trimEndSec: Number(e.target.value) })
                                }
                                className="mt-1 w-full"
                              />
                            </label>
                            <p className="text-[11px] text-emerald-200/90">
                              Keeps {kept != null ? formatHeroTime(kept) : "the full clip"}
                              {duration ? ` of ${formatHeroTime(duration)}` : ""}
                            </p>
                            <button
                              type="button"
                              className="text-[11px] font-semibold text-[var(--accent)] underline"
                              onClick={() =>
                                updateSlide(slide.id, { trimStartSec: 0, trimEndSec: null })
                              }
                            >
                              Reset trim (full clip)
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  ) : null}

                  <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/40 p-3">
                    <p className="text-sm font-semibold">
                      {isVideo ? "2 · Crop" : "1 · Crop"}
                    </p>
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
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-[var(--accent)] underline"
                      onClick={() =>
                        updateSlide(slide.id, { focusX: 50, focusY: 22, zoom: 1 })
                      }
                    >
                      Reset crop
                    </button>
                  </div>

                  {isVideo ? (
                    <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/40 p-3">
                      <p className="text-sm font-semibold">3 · Slow motion</p>
                      <p className="text-[11px] text-[var(--muted)]">
                        Playback speed on the landing (muted). Half speed is the usual slow-mo.
                      </p>
                      <input
                        type="range"
                        min={0}
                        max={HERO_PLAYBACK_RATES.length - 1}
                        step={1}
                        value={Math.max(
                          0,
                          HERO_PLAYBACK_RATES.findIndex(
                            (rate) => Math.abs(rate - slide.playbackRate) < 0.02,
                          ),
                        )}
                        onChange={(e) =>
                          updateSlide(slide.id, {
                            playbackRate: HERO_PLAYBACK_RATES[Number(e.target.value)] ?? 1,
                          })
                        }
                        className="w-full"
                      />
                      <p className="text-sm font-semibold text-[var(--text)]">
                        {SLOW_MO_LABELS[slide.playbackRate] || `${slide.playbackRate}×`}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {HERO_PLAYBACK_RATES.map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                              Math.abs(slide.playbackRate - rate) < 0.02
                                ? "bg-[#7c3aed] text-white"
                                : "btn-ghost"
                            }`}
                            onClick={() => updateSlide(slide.id, { playbackRate: rate })}
                          >
                            {rate === 1 ? "1×" : `${rate}×`}
                          </button>
                        ))}
                      </div>
                    </div>
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
