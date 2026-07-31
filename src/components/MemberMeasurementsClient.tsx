"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PlayableVideoFrame from "@/components/PlayableVideoFrame";
import {
  fromLocalInputValue,
  toLocalInputValue,
} from "@/components/MeasurementFormFields";
import MeasurementsIntroModal from "@/components/MeasurementsIntroModal";
import { useUploadedContentVolumeDb } from "@/hooks/useUploadedContentVolumeDb";
import {
  MEASUREMENT_FIELDS,
  TAPE_MEASUREMENT_FIELDS,
  deltaLabel,
  emptyMeasurementForm,
  formatMeasurementValue,
  originalValuesFromHistory,
  type MeasurementFieldDef,
  type MeasurementFieldId,
  type MeasurementRecord,
} from "@/lib/body-measurements";
import { isYoutubeUrl } from "@/lib/youtube";

/** Label + original (left, locked) + check-in (right, editable). */
function DualMeasureField({
  field,
  original,
  value,
  onChange,
  disabled,
  compact,
}: {
  field: MeasurementFieldDef;
  original: number | null | undefined;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const origLabel = formatMeasurementValue(original, field.unit);
  return (
    <div className={`ms-dual ${compact ? "ms-dual--compact" : ""}`}>
      <div className="ms-dual__title">
        <span className="ms-stat__label">{field.label}</span>
        {field.hint ? (
          <span className="ms-dual__hint">{field.hint}</span>
        ) : null}
      </div>
      <div className="ms-dual__cols">
        <div className="ms-dual__cell ms-dual__cell--orig">
          <span className="ms-dual__col-label">Original</span>
          <span className="ms-dual__orig-value" title="First value you ever logged">
            {origLabel}
          </span>
        </div>
        <div className="ms-dual__cell ms-dual__cell--now">
          <span className="ms-dual__col-label">Check-in</span>
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
            className="ms-stat__input ms-dual__input"
            aria-label={`${field.label} check-in (${field.unit})`}
          />
        </div>
      </div>
      <span className="ms-stat__unit">{field.unit}</span>
    </div>
  );
}

function KeyField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="ms-key block">
      <span className="ms-key__label">{label}</span>
      {children}
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
  const [nowPhotoUrl, setNowPhotoUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState<"before" | "now" | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [ageYears, setAgeYears] = useState("");
  const [gender, setGender] = useState("");
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
      const id = data.identity || {};
      if (typeof id.name === "string") setDisplayName(id.name);
      if (id.ageYears != null && Number.isFinite(Number(id.ageYears))) {
        setAgeYears(String(id.ageYears));
      }
      if (typeof id.gender === "string") setGender(id.gender);
      // Fresh form for a new check-in (originals show from history separately)
      setForm(emptyMeasurementForm());
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
      if (!res.ok) throw new Error(data.error || "Photo upload failed.");
      if (kind === "before") {
        setBeforePhotoUrl(data.url || data.beforePhotoUrl || null);
        setMessage("Before portrait saved.");
      } else {
        setNowPhotoUrl(data.url || data.photoUrl || null);
        setMessage("Now photo attached — inscribe to save with this check-in.");
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
        name: displayName.trim() || null,
        ageYears: ageYears.trim() === "" ? null : Number(ageYears),
        gender: gender.trim() || null,
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
      if (data.identity) {
        if (typeof data.identity.name === "string") setDisplayName(data.identity.name);
        if (data.identity.ageYears != null) setAgeYears(String(data.identity.ageYears));
        else setAgeYears("");
        if (typeof data.identity.gender === "string") setGender(data.identity.gender);
      }
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
  const originals = useMemo(() => originalValuesFromHistory(rows), [rows]);

  return (
    <div className="ms-page mx-auto max-w-4xl space-y-6 pb-10">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .ms-page {
          --ms-ink: #f3e8ff;
          --ms-ink-soft: #c4b5fd;
          --ms-rule: #a78bfa;
          --ms-rule-soft: rgba(167, 139, 250, 0.4);
          --ms-parchment: #1e1035;
          --ms-parchment-deep: #150a28;
          --ms-box: rgba(46, 16, 80, 0.75);
          --ms-accent: #e9d5ff;
          --ms-gold: #f0abfc;
          --ms-royal: #7c3aed;
        }
        .ms-sheet {
          background:
            radial-gradient(ellipse at 15% 0%, rgba(167, 139, 250, 0.22), transparent 45%),
            radial-gradient(ellipse at 90% 100%, rgba(124, 58, 237, 0.28), transparent 50%),
            linear-gradient(165deg, #2a1650 0%, var(--ms-parchment) 40%, var(--ms-parchment-deep) 100%);
          color: var(--ms-ink);
          border: 3px double var(--ms-rule);
          box-shadow:
            0 0 0 1px rgba(88, 28, 135, 0.6),
            0 12px 40px rgba(0, 0, 0, 0.45),
            inset 0 0 80px rgba(124, 58, 237, 0.12);
          border-radius: 6px;
          position: relative;
        }
        .ms-sheet::before {
          content: "";
          pointer-events: none;
          position: absolute;
          inset: 6px;
          border: 1px solid var(--ms-rule-soft);
          border-radius: 3px;
        }
        .ms-sheet-title {
          font-family: ui-serif, Georgia, "Times New Roman", serif;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ms-accent);
          text-shadow: 0 0 24px rgba(167, 139, 250, 0.45);
        }
        .ms-ornament {
          font-family: ui-serif, Georgia, serif;
          color: var(--ms-gold);
          letter-spacing: 0.35em;
          font-size: 0.65rem;
        }
        .ms-section-label {
          font-family: ui-serif, Georgia, serif;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--ms-gold);
          border-bottom: 1px solid var(--ms-rule-soft);
          padding-bottom: 0.25rem;
          margin-bottom: 0.65rem;
        }
        .ms-stat {
          background: var(--ms-box);
          border: 2px solid var(--ms-rule);
          border-radius: 9999px 9999px 6px 6px;
          padding: 0.4rem 0.3rem 0.3rem;
          min-height: 4.25rem;
          box-shadow: inset 0 1px 0 rgba(233, 213, 255, 0.12);
        }
        .ms-stat__label {
          font-family: ui-serif, Georgia, serif;
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ms-ink-soft);
          line-height: 1.15;
        }
        .ms-stat__input {
          width: 100%;
          max-width: 5rem;
          margin-top: 0.1rem;
          background: transparent;
          border: none;
          border-bottom: 1px solid var(--ms-rule-soft);
          text-align: center;
          font-family: ui-serif, Georgia, serif;
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--ms-ink);
          outline: none;
        }
        .ms-stat__input:focus { border-bottom-color: var(--ms-gold); }
        .ms-stat__input:disabled { opacity: 0.6; }
        .ms-stat__unit {
          font-size: 0.52rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--ms-ink-soft);
          margin-top: 0.1rem;
        }
        .ms-key {
          display: block;
          margin-bottom: 0.55rem;
        }
        .ms-key__label {
          display: block;
          font-family: ui-serif, Georgia, serif;
          font-size: 0.58rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ms-gold);
          margin-bottom: 0.15rem;
        }
        .ms-key__input {
          width: 100%;
          background: rgba(20, 8, 40, 0.45);
          border: 1px solid var(--ms-rule-soft);
          border-radius: 4px;
          color: var(--ms-ink);
          font-family: ui-serif, Georgia, serif;
          font-size: 0.9rem;
          font-weight: 600;
          padding: 0.35rem 0.5rem;
          outline: none;
        }
        .ms-key__input:focus {
          border-color: var(--ms-rule);
          box-shadow: 0 0 0 1px rgba(167, 139, 250, 0.35);
        }
        .ms-video-frame {
          background: #0c0618;
          border: 2px double var(--ms-rule);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(233, 213, 255, 0.1);
        }
        .ms-video-label {
          font-family: ui-serif, Georgia, serif;
          font-size: 0.58rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ms-accent);
        }
        .ms-input-line {
          background: transparent;
          border: none;
          border-bottom: 1px solid var(--ms-rule-soft);
          color: var(--ms-ink);
          font-family: ui-serif, Georgia, serif;
          outline: none;
        }
        .ms-input-line:focus { border-bottom-color: var(--ms-gold); }
        .ms-log-row {
          border: 1px solid var(--ms-rule-soft);
          background: rgba(46, 16, 80, 0.45);
        }
        .ms-portrait {
          border: 2px solid var(--ms-rule);
          background: rgba(30, 10, 55, 0.7);
          box-shadow: inset 0 0 0 1px rgba(167, 139, 250, 0.2);
        }
        .ms-portrait__label {
          font-family: ui-serif, Georgia, serif;
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ms-gold);
        }
        .ms-portrait__frame {
          max-height: 7rem;
          aspect-ratio: 3 / 4;
        }
        .ms-dual {
          background: var(--ms-box);
          border: 2px solid var(--ms-rule);
          border-radius: 8px;
          padding: 0.4rem 0.45rem 0.35rem;
          text-align: center;
        }
        .ms-dual__title {
          margin-bottom: 0.3rem;
        }
        .ms-dual__hint {
          display: block;
          font-size: 0.55rem;
          color: var(--ms-ink-soft);
          margin-top: 0.1rem;
        }
        .ms-dual__cols {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.35rem;
          align-items: end;
        }
        .ms-dual__cell {
          min-width: 0;
        }
        .ms-dual__col-label {
          display: block;
          font-family: ui-serif, Georgia, serif;
          font-size: 0.5rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--ms-gold);
          margin-bottom: 0.15rem;
        }
        .ms-dual__orig-value {
          display: block;
          font-family: ui-serif, Georgia, serif;
          font-size: 1rem;
          font-weight: 700;
          color: var(--ms-ink-soft);
          border-bottom: 1px solid var(--ms-rule-soft);
          padding: 0.15rem 0.2rem;
          min-height: 1.6rem;
        }
        .ms-dual__cell--now .ms-stat__input {
          max-width: none;
          width: 100%;
        }
        .ms-dual__input {
          font-size: 1.05rem !important;
        }
        .ms-dual .ms-stat__unit {
          margin-top: 0.25rem;
        }
        .ms-key-pair {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.35rem;
        }
      `,
        }}
      />

      <MeasurementsIntroModal
        videoUrl={hasVideo ? videoUrl : null}
        forceOpen={watchAgain}
        onForceOpenHandled={() => setWatchAgain(false)}
      />

      <form onSubmit={(e) => void handleSave(e)} className="ms-sheet p-4 sm:p-6 md:p-7">
        <header className="relative z-[1] border-b border-[var(--ms-rule-soft)] pb-3">
          <p className="ms-ornament text-center">✦ · royal measure · ✦</p>
          <h1 className="ms-sheet-title mt-1 text-center text-xl font-bold sm:text-2xl">
            Body Measurements
          </h1>
          <p className="mt-1 text-center font-serif text-xs italic text-[var(--ms-ink-soft)]">
            Purple of the crown · same marks each session · Train Station
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3 font-serif text-sm">
            <label className="flex min-w-[11rem] flex-1 flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ms-gold)]">
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
          </div>
        </header>

        {/* Row 1: 3 columns — key data | before | now */}
        <div className="relative z-[1] mt-5 grid gap-3 sm:grid-cols-3 sm:items-start">
          {/* Col 1 — identity / key stats */}
          <div className="rounded-sm border border-[var(--ms-rule-soft)] bg-[rgba(20,8,40,0.35)] p-3">
            <h2 className="ms-section-label !mb-3">Identity · Key</h2>
            <KeyField label="Name">
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={saving}
                className="ms-key__input"
                placeholder="Your name"
                maxLength={80}
              />
            </KeyField>
            <KeyField label="Age">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={120}
                value={ageYears}
                onChange={(e) => setAgeYears(e.target.value)}
                disabled={saving}
                className="ms-key__input"
                placeholder="—"
              />
            </KeyField>
            <KeyField label="Gender">
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                disabled={saving}
                className="ms-key__input"
              >
                <option value="">—</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Prefer not to say">Prefer not to say</option>
                <option value="Other">Other</option>
              </select>
            </KeyField>
            <p className="mb-1 mt-2 text-[9px] font-bold uppercase tracking-wider text-[var(--ms-gold)]">
              Original · left · · Check-in · right
            </p>
            <DualMeasureField
              field={MEASUREMENT_FIELDS.find((f) => f.id === "weightLbs")!}
              original={originals.weightLbs}
              value={form.weightLbs}
              onChange={(v) => setField("weightLbs", v)}
              disabled={saving}
              compact
            />
            <div className="mt-2">
              <DualMeasureField
                field={MEASUREMENT_FIELDS.find((f) => f.id === "bodyFatPct")!}
                original={originals.bodyFatPct}
                value={form.bodyFatPct}
                onChange={(v) => setField("bodyFatPct", v)}
                disabled={saving}
                compact
              />
            </div>
          </div>

          {/* Col 2 — Before (half size) */}
          <div className="ms-portrait overflow-hidden rounded-sm">
            <div className="flex items-center justify-between border-b border-[var(--ms-rule-soft)] px-2 py-1">
              <span className="ms-portrait__label">Before</span>
              <span className="font-serif text-[9px] italic text-[var(--ms-ink-soft)]">
                baseline
              </span>
            </div>
            <div className="ms-portrait__frame relative w-full bg-black/30">
              {beforePhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={beforePhotoUrl}
                  alt="Before progress photo"
                  className="h-full w-full object-cover object-top"
                />
              ) : (
                <div className="flex h-full min-h-[7rem] flex-col items-center justify-center gap-0.5 px-2 text-center">
                  <p className="font-serif text-xs text-[var(--ms-ink-soft)]">No before yet</p>
                </div>
              )}
            </div>
            <div className="border-t border-[var(--ms-rule-soft)] px-2 py-1.5">
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
                className="w-full rounded border border-[var(--ms-rule)] bg-[var(--ms-box)] px-2 py-1 font-serif text-[11px] font-semibold text-[var(--ms-ink)] hover:bg-[rgba(124,58,237,0.35)] disabled:opacity-60"
                disabled={Boolean(photoBusy) || saving}
                onClick={() => beforeFileRef.current?.click()}
              >
                {photoBusy === "before"
                  ? "…"
                  : beforePhotoUrl
                    ? "Replace before"
                    : "Upload before"}
              </button>
            </div>
          </div>

          {/* Col 3 — Now (half size) */}
          <div className="ms-portrait overflow-hidden rounded-sm">
            <div className="flex items-center justify-between border-b border-[var(--ms-rule-soft)] px-2 py-1">
              <span className="ms-portrait__label">Now</span>
              <span className="font-serif text-[9px] italic text-[var(--ms-ink-soft)]">
                this check-in
              </span>
            </div>
            <div className="ms-portrait__frame relative w-full bg-black/30">
              {nowPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={nowPhotoUrl}
                  alt="Current progress photo"
                  className="h-full w-full object-cover object-top"
                />
              ) : (
                <div className="flex h-full min-h-[7rem] flex-col items-center justify-center gap-0.5 px-2 text-center">
                  <p className="font-serif text-xs text-[var(--ms-ink-soft)]">Today&apos;s photo</p>
                </div>
              )}
            </div>
            <div className="flex gap-1 border-t border-[var(--ms-rule-soft)] px-2 py-1.5">
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
                className="min-w-0 flex-1 rounded border border-[var(--ms-rule)] bg-[var(--ms-box)] px-2 py-1 font-serif text-[11px] font-semibold text-[var(--ms-ink)] hover:bg-[rgba(124,58,237,0.35)] disabled:opacity-60"
                disabled={Boolean(photoBusy) || saving}
                onClick={() => nowFileRef.current?.click()}
              >
                {photoBusy === "now" ? "…" : nowPhotoUrl ? "Replace now" : "Upload now"}
              </button>
              {nowPhotoUrl ? (
                <button
                  type="button"
                  className="rounded border border-fuchsia-400/30 px-2 py-1 font-serif text-[11px] text-fuchsia-200"
                  onClick={() => setNowPhotoUrl(null)}
                >
                  ✕
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Below: coach tape list + demo video */}
        <div className="relative z-[1] mt-5 grid gap-4 lg:grid-cols-[1fr_minmax(13rem,16rem)] lg:items-start">
          <div className="min-w-0 space-y-4">
            <div>
              <h2 className="ms-section-label">Measurements · Tape (inches)</h2>
              <p className="mb-2 font-serif text-[11px] italic text-[var(--ms-ink-soft)]">
                Each row: <strong className="text-[var(--ms-gold)]">Original</strong> (first ever,
                left) · <strong className="text-[var(--ms-gold)]">Check-in</strong> (enter now,
                right). First time you log a number, it becomes the all-time original.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {TAPE_MEASUREMENT_FIELDS.map((field) => (
                  <DualMeasureField
                    key={field.id}
                    field={field}
                    original={originals[field.id]}
                    value={form[field.id]}
                    onChange={(v) => setField(field.id, v)}
                    disabled={saving}
                  />
                ))}
              </div>
            </div>
          </div>

          <aside className="lg:sticky lg:top-4">
            <div className="ms-video-frame overflow-hidden rounded-sm">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--ms-rule-soft)] bg-[#12081f] px-2 py-1">
                <span className="ms-video-label">How to measure</span>
                {hasVideo ? (
                  <button
                    type="button"
                    className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ms-accent)] underline-offset-2 hover:underline"
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
                <div className="flex aspect-video flex-col items-center justify-center gap-2 bg-gradient-to-b from-[#1a0b30] to-[#0c0618] px-3 text-center">
                  <p className="font-serif text-sm text-[var(--ms-accent)]">Demonstration</p>
                  <a
                    href="https://www.youtube.com/results?search_query=how+to+take+body+measurements+tape+correctly"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded border border-[var(--ms-rule)] bg-[var(--ms-royal)]/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--ms-ink)]"
                  >
                    ▶ Placeholder · YouTube
                  </a>
                </div>
              )}
              {hasVideo ? (
                <div className="border-t border-[var(--ms-rule-soft)] bg-[#12081f] px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => setWatchAgain(true)}
                    className="w-full text-left text-[10px] text-[var(--ms-ink-soft)] underline-offset-2 hover:text-[var(--ms-accent)] hover:underline"
                  >
                    {isYt ? "Full YouTube player →" : "Full-screen how-to →"}
                  </button>
                </div>
              ) : null}
            </div>
          </aside>
        </div>

        <div className="relative z-[1] mt-5 space-y-3 border-t border-[var(--ms-rule-soft)] pt-4">
          <label className="block">
            <span className="ms-section-label mb-2 block border-0 pb-0">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={saving}
              rows={2}
              placeholder="Morning weight, same pose as before…"
              className="ms-input-line w-full resize-y py-1 text-sm"
              maxLength={2000}
            />
          </label>
          {error ? (
            <p className="rounded border border-rose-400/40 bg-rose-950/50 px-3 py-2 font-serif text-sm text-rose-100">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="font-serif text-sm text-emerald-200">{message}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded border-2 border-[var(--ms-rule)] bg-[var(--ms-royal)] px-5 py-2.5 font-serif text-sm font-bold uppercase tracking-wider text-white shadow-[0_0_20px_rgba(124,58,237,0.45)] transition hover:bg-[#6d28d9] disabled:opacity-60"
            >
              {saving ? "Inscribing…" : "Inscribe check-in"}
            </button>
            <p className="font-serif text-[11px] italic text-[var(--ms-ink-soft)]">
              Key fields + photos up top · tape measures below
            </p>
          </div>
        </div>

        <p className="ms-ornament relative z-[1] mt-6 text-center">✦ · end of sheet · ✦</p>
      </form>

      {latest ? (
        <section className="ms-sheet p-4 sm:p-5">
          <h2 className="ms-section-label relative z-[1]">Last recorded</h2>
          <p className="relative z-[1] font-serif text-xs text-[var(--ms-ink-soft)]">
            {new Date(latest.measuredAt).toLocaleString()} ·{" "}
            {latest.source === "coach" ? "Coach" : "You"}
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
        </section>
      ) : null}

      <section className="ms-sheet p-4 sm:p-5">
        <h2 className="ms-section-label relative z-[1]">Adventure log</h2>
        {loading ? (
          <p className="relative z-[1] font-serif text-sm text-[var(--ms-ink-soft)]">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="relative z-[1] font-serif text-sm italic text-[var(--ms-ink-soft)]">
            No check-ins yet.
          </p>
        ) : (
          <ul className="relative z-[1] space-y-2">
            {rows.map((row) => (
              <li key={row.id} className="ms-log-row rounded px-3 py-2.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-serif text-sm font-semibold text-[var(--ms-ink)]">
                    {new Date(row.measuredAt).toLocaleString()}
                  </p>
                  <button
                    type="button"
                    className="font-serif text-xs text-fuchsia-200 underline-offset-2 hover:underline"
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
                      className="h-12 w-9 shrink-0 rounded object-cover object-top ring-1 ring-[var(--ms-rule-soft)]"
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
    </div>
  );
}
