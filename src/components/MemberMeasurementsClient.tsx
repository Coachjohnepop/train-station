"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PlayableVideoFrame from "@/components/PlayableVideoFrame";
import {
  fromLocalInputValue,
  toLocalInputValue,
} from "@/components/MeasurementFormFields";
import MeasurementsIntroModal from "@/components/MeasurementsIntroModal";
import { useUploadedContentVolumeDb } from "@/hooks/useUploadedContentVolumeDb";
import {
  MEASUREMENT_FIELDS,
  deltaLabel,
  emptyMeasurementForm,
  formatMeasurementValue,
  type MeasurementFieldDef,
  type MeasurementFieldId,
  type MeasurementRecord,
} from "@/lib/body-measurements";
import { isYoutubeUrl } from "@/lib/youtube";

/** Field groups laid out like a classic player sheet. */
const CORE_IDS: MeasurementFieldId[] = ["weightLbs", "bodyFatPct"];
const TORSO_IDS: MeasurementFieldId[] = [
  "neckIn",
  "shouldersIn",
  "chestIn",
  "waistIn",
  "hipsIn",
];
const LIMB_IDS: MeasurementFieldId[] = [
  "leftBicepIn",
  "rightBicepIn",
  "leftThighIn",
  "rightThighIn",
  "leftCalfIn",
  "rightCalfIn",
];

function fieldById(id: MeasurementFieldId): MeasurementFieldDef {
  return MEASUREMENT_FIELDS.find((f) => f.id === id)!;
}

function SheetStatInput({
  field,
  value,
  onChange,
  disabled,
  large,
}: {
  field: MeasurementFieldDef;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  large?: boolean;
}) {
  return (
    <label
      className={`ms-stat flex flex-col items-center justify-center text-center ${
        large ? "ms-stat--large" : ""
      }`}
    >
      <span className="ms-stat__label">{field.label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={field.step}
        min={field.min}
        max={field.max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="—"
        className="ms-stat__input"
        aria-label={`${field.label} (${field.unit})`}
      />
      <span className="ms-stat__unit">{field.unit}</span>
    </label>
  );
}

export default function MemberMeasurementsClient({
  introVideoUrl = null,
}: {
  introVideoUrl?: string | null;
}) {
  const [rows, setRows] = useState<MeasurementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState(emptyMeasurementForm);
  const [notes, setNotes] = useState("");
  const [measuredAtLocal, setMeasuredAtLocal] = useState(() => toLocalInputValue());
  const [watchAgain, setWatchAgain] = useState(false);
  const [beforePhotoUrl, setBeforePhotoUrl] = useState<string | null>(null);
  /** Pending “now” photo for this check-in (saved with form). */
  const [nowPhotoUrl, setNowPhotoUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState<"before" | "now" | null>(null);
  const beforeFileRef = useRef<HTMLInputElement>(null);
  const nowFileRef = useRef<HTMLInputElement>(null);
  const volumeDb = useUploadedContentVolumeDb();

  const videoUrl = introVideoUrl?.trim() || "";
  const hasVideo = Boolean(videoUrl);
  const isYt = hasVideo && isYoutubeUrl(videoUrl);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/member/measurements", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not load measurements.");
        setRows([]);
        return;
      }
      setRows(data.measurements || []);
      setBeforePhotoUrl(
        typeof data.beforePhotoUrl === "string" && data.beforePhotoUrl.trim()
          ? data.beforePhotoUrl.trim()
          : null,
      );
    } catch {
      setError("Could not load measurements.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function setField(id: MeasurementFieldId, value: string) {
    setForm((prev) => ({ ...prev, [id]: value }));
  }

  async function uploadPortrait(kind: "before" | "now", files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setPhotoBusy(kind);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", kind);
      const res = await fetch("/api/member/measurements/photo", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Photo upload failed.");
      }
      if (kind === "before") {
        setBeforePhotoUrl(data.url || data.beforePhotoUrl || null);
        setMessage("Before portrait saved on your sheet.");
      } else {
        setNowPhotoUrl(data.url || data.photoUrl || null);
        setMessage("Now photo attached — inscribe check-in to lock it in the log.");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Photo upload failed.");
    } finally {
      setPhotoBusy(null);
      if (kind === "before" && beforeFileRef.current) beforeFileRef.current.value = "";
      if (kind === "now" && nowFileRef.current) nowFileRef.current.value = "";
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const body: Record<string, unknown> = {
        notes,
        measuredAt: fromLocalInputValue(measuredAtLocal),
        photoUrl: nowPhotoUrl,
      };
      for (const f of MEASUREMENT_FIELDS) {
        body[f.id] = form[f.id] === "" ? null : form[f.id];
      }
      const res = await fetch("/api/member/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Save failed.");
        return;
      }
      setMessage("Check-in inscribed. Your coach can see this sheet too.");
      setForm(emptyMeasurementForm());
      setNotes("");
      setNowPhotoUrl(null);
      setMeasuredAtLocal(toLocalInputValue());
      await load();
    } catch {
      setError("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Erase this check-in from the log?")) return;
    const res = await fetch(`/api/member/measurements/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Delete failed.");
      return;
    }
    await load();
  }

  const latest = rows[0] || null;
  const previous = rows[1] || null;

  return (
    <div className="ms-page mx-auto max-w-4xl space-y-6 pb-10">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .ms-page {
          --ms-ink: #1a1208;
          --ms-ink-soft: #3d2e1a;
          --ms-rule: #8b6914;
          --ms-rule-soft: rgba(139, 105, 20, 0.45);
          --ms-parchment: #f3e6c8;
          --ms-parchment-deep: #e8d4a8;
          --ms-box: rgba(255, 248, 230, 0.92);
          --ms-accent: #6b3e14;
        }
        .ms-sheet {
          background:
            radial-gradient(ellipse at 20% 0%, rgba(255, 255, 255, 0.35), transparent 50%),
            radial-gradient(ellipse at 80% 100%, rgba(120, 80, 20, 0.12), transparent 45%),
            linear-gradient(165deg, var(--ms-parchment) 0%, var(--ms-parchment-deep) 55%, #dcc896 100%);
          color: var(--ms-ink);
          border: 3px double var(--ms-rule);
          box-shadow:
            0 0 0 1px rgba(60, 40, 10, 0.35),
            0 12px 40px rgba(0, 0, 0, 0.35),
            inset 0 0 60px rgba(90, 60, 20, 0.08);
          border-radius: 4px;
          position: relative;
        }
        .ms-sheet::before {
          content: "";
          pointer-events: none;
          position: absolute;
          inset: 6px;
          border: 1px solid var(--ms-rule-soft);
          border-radius: 2px;
        }
        .ms-sheet-title {
          font-family: ui-serif, Georgia, "Times New Roman", serif;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--ms-accent);
        }
        .ms-ornament {
          font-family: ui-serif, Georgia, serif;
          color: var(--ms-rule);
          letter-spacing: 0.35em;
          font-size: 0.65rem;
        }
        .ms-section-label {
          font-family: ui-serif, Georgia, serif;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--ms-accent);
          border-bottom: 1px solid var(--ms-rule-soft);
          padding-bottom: 0.25rem;
          margin-bottom: 0.65rem;
        }
        .ms-stat {
          background: var(--ms-box);
          border: 2px solid var(--ms-rule);
          border-radius: 9999px 9999px 6px 6px;
          padding: 0.45rem 0.35rem 0.35rem;
          min-height: 4.5rem;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
        }
        .ms-stat--large {
          min-height: 5.5rem;
          border-radius: 8px;
        }
        .ms-stat__label {
          font-family: ui-serif, Georgia, serif;
          font-size: 0.58rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ms-ink-soft);
          line-height: 1.15;
        }
        .ms-stat__input {
          width: 100%;
          max-width: 5.5rem;
          margin-top: 0.15rem;
          background: transparent;
          border: none;
          border-bottom: 1px solid var(--ms-rule-soft);
          text-align: center;
          font-family: ui-serif, Georgia, serif;
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--ms-ink);
          outline: none;
        }
        .ms-stat--large .ms-stat__input {
          font-size: 1.45rem;
          max-width: 6.5rem;
        }
        .ms-stat__input:focus {
          border-bottom-color: var(--ms-rule);
        }
        .ms-stat__input:disabled {
          opacity: 0.6;
        }
        .ms-stat__unit {
          font-size: 0.55rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--ms-ink-soft);
          margin-top: 0.15rem;
        }
        .ms-video-frame {
          background: #0c0a08;
          border: 3px double var(--ms-rule);
          box-shadow:
            0 4px 16px rgba(0, 0, 0, 0.35),
            inset 0 0 0 1px rgba(255, 220, 140, 0.15);
        }
        .ms-video-label {
          font-family: ui-serif, Georgia, serif;
          font-size: 0.62rem;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #e8d4a8;
        }
        .ms-input-line {
          background: transparent;
          border: none;
          border-bottom: 1px solid var(--ms-rule-soft);
          color: var(--ms-ink);
          font-family: ui-serif, Georgia, serif;
          outline: none;
        }
        .ms-input-line:focus {
          border-bottom-color: var(--ms-rule);
        }
        .ms-log-row {
          border: 1px solid var(--ms-rule-soft);
          background: rgba(255, 248, 230, 0.55);
        }
        .ms-portrait {
          border: 2px solid var(--ms-rule);
          background: rgba(255, 248, 230, 0.65);
          box-shadow: inset 0 0 0 1px rgba(139, 105, 20, 0.25);
        }
        .ms-portrait__label {
          font-family: ui-serif, Georgia, serif;
          font-size: 0.58rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ms-accent);
        }
      `,
        }}
      />

      <MeasurementsIntroModal
        videoUrl={hasVideo ? videoUrl : null}
        forceOpen={watchAgain}
        onForceOpenHandled={() => setWatchAgain(false)}
      />

      {/* —— Character sheet —— */}
      <form onSubmit={(e) => void handleSave(e)} className="ms-sheet p-4 sm:p-6 md:p-8">
        {/* Nameplate */}
        <header className="relative z-[1] border-b-2 border-[var(--ms-rule)] pb-3">
          <p className="ms-ornament text-center">✦ · · · ✦ · · · ✦</p>
          <h1 className="ms-sheet-title mt-1 text-center text-xl font-bold sm:text-2xl">
            Body Measurements
          </h1>
          <p className="mt-1 text-center font-serif text-xs italic text-[var(--ms-ink-soft)]">
            Player sheet · Train Station · use the same marks each session
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3 font-serif text-sm">
            <label className="flex min-w-[12rem] flex-1 flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ms-accent)]">
                Date measured
              </span>
              <input
                type="datetime-local"
                value={measuredAtLocal}
                onChange={(e) => setMeasuredAtLocal(e.target.value)}
                disabled={saving}
                className="ms-input-line w-full py-1 text-sm"
              />
            </label>
            <p className="text-[10px] uppercase tracking-wider text-[var(--ms-ink-soft)]">
              Class: <span className="font-semibold text-[var(--ms-ink)]">Athlete</span>
              {" · "}
              Level: <span className="font-semibold text-[var(--ms-ink)]">Consistency</span>
            </p>
          </div>
        </header>

        {/* Portraits — Before (baseline) + Now (this check-in) */}
        <div className="relative z-[1] mt-5">
          <h2 className="ms-section-label">Portrait · Before &amp; now</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="ms-portrait overflow-hidden rounded-sm">
              <div className="flex items-center justify-between border-b border-[var(--ms-rule-soft)] px-2.5 py-1.5">
                <span className="ms-portrait__label">Before</span>
                <span className="font-serif text-[10px] italic text-[var(--ms-ink-soft)]">
                  starting look
                </span>
              </div>
              <div className="relative aspect-[3/4] max-h-56 w-full bg-[#1a1208]/10">
                {beforePhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={beforePhotoUrl}
                    alt="Before progress photo"
                    className="h-full w-full object-cover object-top"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 px-3 text-center">
                    <p className="font-serif text-sm text-[var(--ms-ink-soft)]">No before photo yet</p>
                    <p className="text-[10px] text-[var(--ms-ink-soft)]">
                      Upload a full-body or mid-shot from day one
                    </p>
                  </div>
                )}
              </div>
              <div className="border-t border-[var(--ms-rule-soft)] px-2.5 py-2">
                <input
                  ref={beforeFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => void uploadPortrait("before", e.target.files)}
                />
                <button
                  type="button"
                  className="w-full rounded border border-[var(--ms-rule)] bg-[var(--ms-box)] px-2 py-1.5 font-serif text-xs font-semibold text-[var(--ms-ink)] hover:bg-white/50 disabled:opacity-60"
                  disabled={Boolean(photoBusy) || saving}
                  onClick={() => beforeFileRef.current?.click()}
                >
                  {photoBusy === "before"
                    ? "Uploading…"
                    : beforePhotoUrl
                      ? "Replace before photo"
                      : "Upload before photo"}
                </button>
              </div>
            </div>

            <div className="ms-portrait overflow-hidden rounded-sm">
              <div className="flex items-center justify-between border-b border-[var(--ms-rule-soft)] px-2.5 py-1.5">
                <span className="ms-portrait__label">Now</span>
                <span className="font-serif text-[10px] italic text-[var(--ms-ink-soft)]">
                  this check-in
                </span>
              </div>
              <div className="relative aspect-[3/4] max-h-56 w-full bg-[#1a1208]/10">
                {nowPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={nowPhotoUrl}
                    alt="Current progress photo"
                    className="h-full w-full object-cover object-top"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 px-3 text-center">
                    <p className="font-serif text-sm text-[var(--ms-ink-soft)]">Add today&apos;s photo</p>
                    <p className="text-[10px] text-[var(--ms-ink-soft)]">
                      Same pose as before when you can
                    </p>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 border-t border-[var(--ms-rule-soft)] px-2.5 py-2">
                <input
                  ref={nowFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => void uploadPortrait("now", e.target.files)}
                />
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded border border-[var(--ms-rule)] bg-[var(--ms-box)] px-2 py-1.5 font-serif text-xs font-semibold text-[var(--ms-ink)] hover:bg-white/50 disabled:opacity-60"
                  disabled={Boolean(photoBusy) || saving}
                  onClick={() => nowFileRef.current?.click()}
                >
                  {photoBusy === "now"
                    ? "Uploading…"
                    : nowPhotoUrl
                      ? "Replace now photo"
                      : "Upload now photo"}
                </button>
                {nowPhotoUrl ? (
                  <button
                    type="button"
                    className="rounded border border-rose-800/30 px-2 py-1.5 font-serif text-xs text-rose-900"
                    onClick={() => setNowPhotoUrl(null)}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>
          </div>
          <p className="mt-2 font-serif text-[11px] italic text-[var(--ms-ink-soft)]">
            Before stays on your sheet until you replace it. Now is saved with this check-in when you
            inscribe.
          </p>
        </div>

        {/* Main sheet: stats wrap around video (upper-right) */}
        <div className="relative z-[1] mt-5 grid gap-4 lg:grid-cols-[1fr_minmax(15rem,18.5rem)] lg:items-start">
          {/* Left column — core + torso */}
          <div className="min-w-0 space-y-5">
            <div>
              <h2 className="ms-section-label">Ability scores · Core</h2>
              <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
                {CORE_IDS.map((id) => (
                  <SheetStatInput
                    key={id}
                    field={fieldById(id)}
                    value={form[id]}
                    onChange={(v) => setField(id, v)}
                    disabled={saving}
                    large
                  />
                ))}
              </div>
            </div>

            <div>
              <h2 className="ms-section-label">Torso · Girth</h2>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {TORSO_IDS.map((id) => (
                  <SheetStatInput
                    key={id}
                    field={fieldById(id)}
                    value={form[id]}
                    onChange={(v) => setField(id, v)}
                    disabled={saving}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right — demonstration video (sheet upper-right) */}
          <aside className="lg:sticky lg:top-4">
            <div className="ms-video-frame overflow-hidden rounded-sm">
              <div className="flex items-center justify-between gap-2 border-b border-[#8b6914]/50 bg-[#1a1208] px-2.5 py-1.5">
                <span className="ms-video-label">Demonstration · How to measure</span>
                {hasVideo ? (
                  <button
                    type="button"
                    className="text-[10px] font-semibold uppercase tracking-wide text-[#e8d4a8] underline-offset-2 hover:underline"
                    onClick={() => setWatchAgain(true)}
                  >
                    Expand
                  </button>
                ) : null}
              </div>

              {hasVideo ? (
                <div className="aspect-video w-full bg-black">
                  <PlayableVideoFrame
                    className="aspect-video h-full w-full"
                    videoUrl={videoUrl}
                    title="How to take your measurements"
                    volumeDb={volumeDb}
                    autoplay={false}
                    duckBackgroundMusic
                  />
                </div>
              ) : (
                <div className="flex aspect-video flex-col items-center justify-center gap-2 bg-gradient-to-b from-[#1a1208] to-[#0c0a08] px-4 text-center">
                  <p className="font-serif text-sm text-[#e8d4a8]">Demonstration video</p>
                  <p className="max-w-[14rem] text-[11px] leading-relaxed text-[#c4b089]/90">
                    Coach hasn&apos;t assigned a how-to clip yet. When they do (Admin → Videos →
                    Measurements how-to), it plays here.
                  </p>
                  <a
                    href="https://www.youtube.com/results?search_query=how+to+take+body+measurements+tape+correctly"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1.5 rounded border border-[#8b6914] bg-[#2a1c0c] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#f3e6c8] transition hover:bg-[#3d2a14]"
                  >
                    <span aria-hidden>▶</span> Placeholder · YouTube how-to search
                  </a>
                  <p className="text-[10px] text-[#8b6914]">
                    Link opens a generic search until your coach uploads
                  </p>
                </div>
              )}

              <div className="border-t border-[#8b6914]/40 bg-[#1a1208] px-2.5 py-2">
                {hasVideo ? (
                  <button
                    type="button"
                    onClick={() => setWatchAgain(true)}
                    className="w-full text-left text-[11px] text-[#c4b089] underline-offset-2 hover:text-[#f3e6c8] hover:underline"
                  >
                    {isYt ? "Open full YouTube player →" : "Watch full-screen how-to →"}
                  </button>
                ) : (
                  <p className="text-[10px] leading-snug text-[#8b6914]">
                    Tip: same tape landmarks every time — neck, chest, waist, hips, mid-limb.
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* Limbs full width under the wrap */}
        <div className="relative z-[1] mt-5">
          <h2 className="ms-section-label">Limbs · Left & right</h2>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-6">
            {LIMB_IDS.map((id) => (
              <SheetStatInput
                key={id}
                field={fieldById(id)}
                value={form[id]}
                onChange={(v) => setField(id, v)}
                disabled={saving}
              />
            ))}
          </div>
        </div>

        {/* Notes + save */}
        <div className="relative z-[1] mt-5 space-y-3 border-t border-[var(--ms-rule-soft)] pt-4">
          <label className="block">
            <span className="ms-section-label mb-2 block border-0 pb-0">Notes & conditions</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={saving}
              rows={2}
              placeholder="Morning weight, post-workout, how the tape felt…"
              className="ms-input-line w-full resize-y py-1 text-sm"
              maxLength={2000}
            />
          </label>

          {error ? (
            <p className="rounded border border-rose-800/40 bg-rose-100/80 px-3 py-2 font-serif text-sm text-rose-900">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="font-serif text-sm text-emerald-900">{message}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded border-2 border-[var(--ms-rule)] bg-[var(--ms-accent)] px-5 py-2.5 font-serif text-sm font-bold uppercase tracking-wider text-[#f3e6c8] shadow transition hover:bg-[#5a3210] disabled:opacity-60"
            >
              {saving ? "Inscribing…" : "Inscribe check-in"}
            </button>
            <p className="font-serif text-[11px] italic text-[var(--ms-ink-soft)]">
              Leave blank any field you skip. One number or a note is enough.
            </p>
          </div>
        </div>

        <p className="ms-ornament relative z-[1] mt-6 text-center">✦ · end of sheet · ✦</p>
      </form>

      {/* Latest snapshot — still parchment-adjacent */}
      {latest ? (
        <section className="ms-sheet p-4 sm:p-5">
          <h2 className="ms-section-label relative z-[1]">Last recorded · Current sheet</h2>
          <p className="relative z-[1] font-serif text-xs text-[var(--ms-ink-soft)]">
            {new Date(latest.measuredAt).toLocaleString()} ·{" "}
            {latest.source === "coach" ? "Logged by coach" : "You"}
          </p>
          <div className="relative z-[1] mt-3 grid gap-2 sm:grid-cols-3">
            {MEASUREMENT_FIELDS.filter((f) => latest[f.id] != null).map((f) => {
              const d = previous ? deltaLabel(latest[f.id], previous[f.id]) : null;
              return (
                <div key={f.id} className="ms-stat !min-h-0 !rounded-md px-3 py-2">
                  <p className="ms-stat__label">{f.label}</p>
                  <p className="font-serif text-lg font-bold tabular-nums text-[var(--ms-ink)]">
                    {formatMeasurementValue(latest[f.id], f.unit)}
                  </p>
                  {d ? (
                    <p className="text-[11px] text-[var(--ms-ink-soft)]">
                      vs prior: <span className="tabular-nums">{d}</span>
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
          {latest.notes ? (
            <p className="relative z-[1] mt-3 font-serif text-sm italic text-[var(--ms-ink-soft)]">
              {latest.notes}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Adventure log / history */}
      <section className="ms-sheet p-4 sm:p-5">
        <h2 className="ms-section-label relative z-[1]">Adventure log · Prior check-ins</h2>
        {loading ? (
          <p className="relative z-[1] font-serif text-sm text-[var(--ms-ink-soft)]">
            Unrolling the scroll…
          </p>
        ) : rows.length === 0 ? (
          <p className="relative z-[1] font-serif text-sm italic text-[var(--ms-ink-soft)]">
            No check-ins yet. Fill the sheet above and inscribe your first entry.
          </p>
        ) : (
          <ul className="relative z-[1] space-y-2">
            {rows.map((row) => (
              <li key={row.id} className="ms-log-row rounded px-3 py-2.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-serif text-sm font-semibold text-[var(--ms-ink)]">
                      {new Date(row.measuredAt).toLocaleString()}
                    </p>
                    <p className="text-[11px] text-[var(--ms-ink-soft)]">
                      {row.source === "coach" ? "Coach entry" : "Member entry"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="font-serif text-xs text-rose-900 underline-offset-2 hover:underline"
                    onClick={() => void handleDelete(row.id)}
                  >
                    Erase
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap items-start gap-3">
                  {row.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.photoUrl}
                      alt="Check-in photo"
                      className="h-16 w-12 shrink-0 rounded object-cover object-top ring-1 ring-[var(--ms-rule-soft)]"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-x-3 gap-y-1 font-serif text-xs tabular-nums text-[var(--ms-ink-soft)]">
                      {MEASUREMENT_FIELDS.filter((f) => row[f.id] != null).map((f) => (
                        <span key={f.id}>
                          {f.label}:{" "}
                          <span className="font-semibold text-[var(--ms-ink)]">
                            {formatMeasurementValue(row[f.id], f.unit)}
                          </span>
                        </span>
                      ))}
                    </div>
                    {row.notes ? (
                      <p className="mt-1 font-serif text-sm italic text-[var(--ms-ink-soft)]">
                        {row.notes}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-center font-serif text-xs italic text-[var(--muted)]">
        Same landmarks every time · your coach sees every inscribed check-in
      </p>
    </div>
  );
}
