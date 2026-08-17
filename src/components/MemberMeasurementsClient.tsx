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
import { compressImageForUpload } from "@/lib/client-image-compress";
import {
  DEFAULT_PHOTO_CROP,
  normalizePhotoCrop,
  photoCropStyle,
  type PhotoCrop,
} from "@/lib/photo-crop";
import { isYoutubeUrl } from "@/lib/youtube";

/** Label + original (left) + check-in (right). Left is an input until a start exists. */
function DualMeasureField({
  field,
  original,
  value,
  onChange,
  originalDraft,
  onOriginalChange,
  disabled,
  compact,
}: {
  field: MeasurementFieldDef;
  original: number | null | undefined;
  value: string;
  onChange: (v: string) => void;
  originalDraft?: string;
  onOriginalChange?: (v: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const origLabel = formatMeasurementValue(original, field.unit);
  const canEditOriginal = Boolean(onOriginalChange) && (original == null || !Number.isFinite(original));
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
          <span className="ms-dual__col-label">Starting</span>
          {canEditOriginal ? (
            <input
              type="number"
              inputMode="decimal"
              step={field.step}
              min={field.min}
              max={field.max}
              value={originalDraft ?? ""}
              onChange={(e) => onOriginalChange?.(e.target.value)}
              disabled={disabled}
              placeholder="—"
              className="ms-stat__input ms-dual__input"
              aria-label={`${field.label} starting (${field.unit})`}
            />
          ) : (
            <span className="ms-dual__orig-value" title="First value you logged">
              {origLabel}
            </span>
          )}
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

function WeightTrioField({
  start,
  goal,
  checkIn,
  onStart,
  onGoal,
  onCheckIn,
  disabled,
}: {
  start: string;
  goal: string;
  checkIn: string;
  onStart: (v: string) => void;
  onGoal: (v: string) => void;
  onCheckIn: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="ms-dual">
      <div className="ms-dual__title">
        <span className="ms-stat__label">Weight</span>
        <span className="ms-dual__hint">
          Starting comes from setup if you already entered it. Check-in is today only.
        </span>
      </div>
      <div className="ms-dual__cols ms-dual__cols--three">
        <div className="ms-dual__cell">
          <span className="ms-dual__col-label">Starting</span>
          <input
            type="number"
            inputMode="decimal"
            step={0.1}
            min={50}
            max={500}
            value={start}
            onChange={(e) => onStart(e.target.value)}
            disabled={disabled}
            placeholder="—"
            className="ms-stat__input ms-dual__input"
            aria-label="Starting weight (lbs)"
          />
        </div>
        <div className="ms-dual__cell">
          <span className="ms-dual__col-label">Goal</span>
          <input
            type="number"
            inputMode="decimal"
            step={0.1}
            min={50}
            max={500}
            value={goal}
            onChange={(e) => onGoal(e.target.value)}
            disabled={disabled}
            placeholder="—"
            className="ms-stat__input ms-dual__input"
            aria-label="Goal weight (lbs)"
          />
        </div>
        <div className="ms-dual__cell ms-dual__cell--now">
          <span className="ms-dual__col-label">Check-in</span>
          <input
            type="number"
            inputMode="decimal"
            step={0.1}
            min={50}
            max={500}
            value={checkIn}
            onChange={(e) => onCheckIn(e.target.value)}
            disabled={disabled}
            placeholder="—"
            className="ms-stat__input ms-dual__input"
            aria-label="Check-in weight (lbs)"
          />
        </div>
      </div>
      <span className="ms-stat__unit">lbs</span>
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
  freeExplorer = false,
  firstOnboard = false,
}: {
  introVideoUrl?: string | null;
  /** Soft glass ceiling: full multi-check-in archive is Coach Class+. */
  freeExplorer?: boolean;
  firstOnboard?: boolean;
}) {
  const [rows, setRows] = useState<MeasurementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  /**
   * Sticky floating Save bar while filling the sheet.
   * After the first Save press in this page visit, dock it to the form footer
   * so it no longer hovers over content.
   */
  const [floatSave, setFloatSave] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const formSaveRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState(emptyMeasurementForm);
  const [notes, setNotes] = useState("");
  const [measuredAtLocal, setMeasuredAtLocal] = useState(() => toLocalInputValue());
  const [watchAgain, setWatchAgain] = useState(false);
  const [beforePhotoUrl, setBeforePhotoUrl] = useState<string | null>(null);
  const [nowPhotoUrl, setNowPhotoUrl] = useState<string | null>(null);
  const [beforeCrop, setBeforeCrop] = useState<PhotoCrop>({ ...DEFAULT_PHOTO_CROP });
  const [nowCrop, setNowCrop] = useState<PhotoCrop>({ ...DEFAULT_PHOTO_CROP });
  /** Crop sliders open only while editing; collapse after Save crop / when not needed. */
  const [beforeCropOpen, setBeforeCropOpen] = useState(false);
  const [nowCropOpen, setNowCropOpen] = useState(false);
  const [cropSaving, setCropSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState<"before" | "now" | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [ageYears, setAgeYears] = useState("");
  const [gender, setGender] = useState("");
  const [startWeightLbs, setStartWeightLbs] = useState("");
  const [goalWeightLbs, setGoalWeightLbs] = useState("");
  const [baseline, setBaseline] = useState(emptyMeasurementForm);
  /** Local preview while upload in flight (object URL). */
  const [beforePreviewLocal, setBeforePreviewLocal] = useState<string | null>(null);
  const [nowPreviewLocal, setNowPreviewLocal] = useState<string | null>(null);
  /** Library pickers (no capture attribute). */
  const beforeLibraryRef = useRef<HTMLInputElement>(null);
  const nowLibraryRef = useRef<HTMLInputElement>(null);
  /** Camera capture. */
  const beforeCameraRef = useRef<HTMLInputElement>(null);
  const nowCameraRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);
  const photoBusyRef = useRef<"before" | "now" | null>(null);
  const volumeDb = useUploadedContentVolumeDb();

  const videoUrl = introVideoUrl?.trim() || "";
  const hasVideo = Boolean(videoUrl);
  const isYt = hasVideo && isYoutubeUrl(videoUrl);

  const beforeDisplayUrl = beforePreviewLocal || beforePhotoUrl;
  const nowDisplayUrl = nowPreviewLocal || nowPhotoUrl;

  const load = useCallback(
    async (opts?: { preserveNow?: boolean; preserveForm?: boolean }) => {
      // Soft refresh after photo upload should not flip the whole sheet into loading
      if (!opts?.preserveForm) setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/member/measurements", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Could not load measurements.");
          if (!opts?.preserveForm) setRows([]);
          return;
        }
        const list = (data.measurements || []) as MeasurementRecord[];
        setRows(list);
        setBeforePhotoUrl(
          typeof data.beforePhotoUrl === "string" && data.beforePhotoUrl.trim()
            ? data.beforePhotoUrl.trim()
            : null,
        );
        if (!opts?.preserveForm) {
          setBeforeCrop(normalizePhotoCrop(data.beforePhotoCrop || null));
          setBeforeCropOpen(false);
        } else {
          // Soft refresh: still adopt crop if we had none
          setBeforeCrop((prev) =>
            prev ? prev : normalizePhotoCrop(data.beforePhotoCrop || null),
          );
        }
        const id = data.identity || {};
        if (!opts?.preserveForm) {
          if (typeof id.name === "string") setDisplayName(id.name);
          if (id.ageYears != null && Number.isFinite(Number(id.ageYears))) {
            setAgeYears(String(id.ageYears));
          }
          if (typeof id.gender === "string") {
            const g = id.gender.trim().toLowerCase();
            setGender(g === "man" || g === "male" || g === "m" ? "man" : g === "woman" || g === "female" || g === "f" ? "woman" : "");
          }
          if (id.startWeightLbs != null && String(id.startWeightLbs).trim()) {
            setStartWeightLbs(String(id.startWeightLbs).trim());
          }
          if (id.goalWeightLbs != null && String(id.goalWeightLbs).trim()) {
            setGoalWeightLbs(String(id.goalWeightLbs).trim());
          }
          // Fresh form for a new check-in (originals show from history separately)
          setForm(emptyMeasurementForm());
          setBaseline(emptyMeasurementForm());
        }
        if (!opts?.preserveNow) {
          setNowPhotoUrl(null);
          setNowCrop({ ...DEFAULT_PHOTO_CROP });
          setNowCropOpen(false);
          setNowPreviewLocal((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
        }
        if (!opts?.preserveForm) {
          setBeforePreviewLocal((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
        }
      } catch {
        if (!opts?.preserveForm) setError("Could not load measurements.");
      } finally {
        if (!opts?.preserveForm) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  function setField(id: MeasurementFieldId, value: string) {
    setForm((prev) => ({ ...prev, [id]: value }));
  }

  async function uploadPortrait(kind: "before" | "now", files: FileList | null) {
    const raw = files?.[0];
    if (!raw) return;
    if (photoBusyRef.current || savingRef.current) {
      setMessage("Already busy — wait a moment, then try again.");
      return;
    }
    photoBusyRef.current = kind;
    setPhotoBusy(kind);
    setError(null);
    setMessage("Processing photo…");

    // Instant local preview (must render via *DisplayUrl in the frames)
    const localUrl = URL.createObjectURL(raw);
    if (kind === "before") {
      setBeforePreviewLocal((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return localUrl;
      });
    } else {
      setNowPreviewLocal((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return localUrl;
      });
    }

    try {
      let file: File;
      try {
        setMessage("Compressing photo…");
        file = await compressImageForUpload(raw);
      } catch (compressErr) {
        if (raw.size > 0 && raw.size <= 3.2 * 1024 * 1024) {
          file = raw;
        } else {
          throw compressErr;
        }
      }

      // Prefer a JPEG name so server MIME sniffing works on mobile
      const uploadName =
        file.name && /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)
          ? file.name
          : "photo.jpg";
      const uploadFile =
        file.type && file.type !== "application/octet-stream"
          ? file
          : new File([file], uploadName, {
              type: file.type || "image/jpeg",
              lastModified: Date.now(),
            });

      setMessage("Uploading photo…");
      const formData = new FormData();
      formData.append("file", uploadFile, uploadName);
      formData.append("kind", kind);
      const res = await fetch("/api/member/measurements/photo", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        url?: string;
        beforePhotoUrl?: string;
        photoUrl?: string;
      };
      if (!res.ok) {
        throw new Error(
          data.error ||
            (res.status === 401
              ? "Sign in again to upload photos."
              : res.status === 403
                ? "Your account can’t upload yet (payment/approval)."
                : res.status === 413
                  ? "Photo too large for the server. Try Library and a smaller image."
                  : `Photo upload failed (${res.status}).`),
        );
      }
      const url = (data.url || data.beforePhotoUrl || data.photoUrl || "").trim();
      if (!url) throw new Error("Upload succeeded but no photo URL came back.");

      if (kind === "before") {
        setBeforePhotoUrl(url);
        setBeforeCrop({ ...DEFAULT_PHOTO_CROP });
        setBeforeCropOpen(false);
        // Switch frame from blob preview → durable URL (local kept if remote fails to paint)
        setBeforePreviewLocal((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        setMessage("Before photo saved. Tap Crop to adjust framing if you want.");
      } else {
        // Keep Now photo in the frame (do not null it after persist)
        setNowPhotoUrl(url);
        setNowCrop({ ...DEFAULT_PHOTO_CROP });
        setNowCropOpen(false);
        setNowPreviewLocal((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        // Persist immediately so it survives refresh; leave URL in state for the frame
        setMessage("Saving now photo to your log…");
        const persist = await fetch("/api/member/measurements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            photoUrl: url,
            photoFocusX: 50,
            photoFocusY: 25,
            photoZoom: 1,
            measuredAt: new Date().toISOString(),
            notes: "Photo check-in",
          }),
        });
        const persistData = await persist.json().catch(() => ({}));
        if (!persist.ok) {
          setMessage(
            "Photo is in the frame — tap Save check-in to lock it on this visit.",
          );
          setError(
            typeof persistData.error === "string"
              ? persistData.error
              : "Could not auto-save photo check-in.",
          );
        } else {
          setMessage("Now photo saved and showing above. Add numbers, then Save if you want.");
          // Refresh history without wiping the Now frame or typed check-in numbers
          void load({ preserveNow: true, preserveForm: true }).catch(() => undefined);
        }
      }
    } catch (e: unknown) {
      setMessage(null);
      setError(e instanceof Error ? e.message : "Photo upload failed.");
      // Keep local preview so they still see what they picked
    } finally {
      photoBusyRef.current = null;
      setPhotoBusy(null);
      for (const ref of [
        beforeLibraryRef,
        beforeCameraRef,
        nowLibraryRef,
        nowCameraRef,
      ]) {
        if (ref.current) ref.current.value = "";
      }
    }
  }

  function dockSaveBar() {
    setFloatSave(false);
    // Bring the in-form Save into view after the floating bar goes away
    requestAnimationFrame(() => {
      formSaveRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }

  async function saveCheckIn() {
    if (photoBusyRef.current) {
      setError("Wait for the photo upload to finish, then save.");
      return;
    }
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    // First press in this visit: stop hovering — Save lives at the bottom of the sheet
    dockSaveBar();
    setError(null);
    setMessage(null);
    try {
      const ageRaw = ageYears.trim();
      const ageNum = ageRaw === "" ? null : Number(ageRaw);
      if (ageRaw !== "" && (!Number.isFinite(ageNum) || (ageNum as number) < 1 || (ageNum as number) > 120)) {
        throw new Error("Age must be a number between 1 and 120 (or leave blank).");
      }

      const body: Record<string, unknown> = {
        notes,
        measuredAt: fromLocalInputValue(measuredAtLocal),
        photoUrl: nowPhotoUrl,
        photoFocusX: nowCrop.focusX,
        photoFocusY: nowCrop.focusY,
        photoZoom: nowCrop.zoom,
        name: displayName.trim() || null,
        ageYears: ageNum,
        gender: gender.trim() || null,
        startWeightLbs: startWeightLbs.trim() || null,
        goalWeightLbs: goalWeightLbs.trim() || null,
      };
      for (const f of MEASUREMENT_FIELDS) {
        const nowVal = form[f.id]?.trim() || "";
        const startVal = baseline[f.id]?.trim() || "";
        body[f.id] = nowVal || startVal || null;
      }

      const hasMeasure = MEASUREMENT_FIELDS.some(
        (f) => form[f.id]?.trim() || baseline[f.id]?.trim(),
      );
      const hasNote = Boolean(notes.trim());
      const hasNow = Boolean(nowPhotoUrl);
      const hasWeights = Boolean(startWeightLbs.trim() || goalWeightLbs.trim());
      if (!hasMeasure && !hasNote && !hasNow) {
        const hasIdentity =
          Boolean(displayName.trim()) ||
          ageRaw !== "" ||
          Boolean(gender.trim()) ||
          hasWeights;
        if (!hasIdentity) {
          throw new Error(
            "Nothing to save — enter starting, goal, or check-in weight, take a Now photo, or add a note.",
          );
        }
        const idRes = await fetch("/api/member/measurements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            name: body.name,
            ageYears: body.ageYears,
            gender: body.gender,
            startWeightLbs: body.startWeightLbs,
            goalWeightLbs: body.goalWeightLbs,
          }),
        });
        const idData = await idRes.json().catch(() => ({}));
        if (!idRes.ok) {
          throw new Error(idData.error || "Could not save identity.");
        }
        setMessage(
          hasWeights
            ? "Starting and goal weight saved."
            : "Identity saved.",
        );
        // Release spinner before refresh so Save never looks stuck
        savingRef.current = false;
        setSaving(false);
        void load({ preserveNow: true }).catch(() => undefined);
        return;
      }

      const res = await fetch("/api/member/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Save failed.");
      }
      setMessage("Saved to your sheet and the adventure log. Your coach can see this too.");
      if (firstOnboard) {
        window.location.assign("/member/today");
        return;
      }
      setForm(emptyMeasurementForm());
      setNotes("");
      setNowPhotoUrl(null);
      setNowPreviewLocal((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setNowCrop({ ...DEFAULT_PHOTO_CROP });
      setNowCropOpen(false);
      setMeasuredAtLocal(toLocalInputValue());
      if (data.identity) {
        if (typeof data.identity.name === "string") setDisplayName(data.identity.name);
        if (data.identity.ageYears != null) setAgeYears(String(data.identity.ageYears));
        else setAgeYears("");
        if (typeof data.identity.gender === "string") {
          const g = data.identity.gender.trim().toLowerCase();
          setGender(
            g === "man" || g === "male" || g === "m"
              ? "man"
              : g === "woman" || g === "female" || g === "f"
                ? "woman"
                : "",
          );
        }
      }
      if (typeof data.beforePhotoUrl === "string" && data.beforePhotoUrl.trim()) {
        setBeforePhotoUrl(data.beforePhotoUrl.trim());
      }
      savingRef.current = false;
      setSaving(false);
      void load({ preserveNow: false }).catch(() => undefined);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed.");
      savingRef.current = false;
      setSaving(false);
    } finally {
      // Safety if an early path forgot to clear
      if (savingRef.current) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    await saveCheckIn();
  }

  async function saveBeforeCrop() {
    if (!beforePhotoUrl) return;
    setCropSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/member/measurements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beforePhotoCrop: {
            focusX: beforeCrop.focusX,
            focusY: beforeCrop.focusY,
            zoom: beforeCrop.zoom,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save crop.");
      if (data.beforePhotoCrop) setBeforeCrop(normalizePhotoCrop(data.beforePhotoCrop));
      setBeforeCropOpen(false);
      setMessage("Before photo crop saved.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save crop.");
    } finally {
      setCropSaving(false);
    }
  }

  const saveButtonClass =
    "inline-flex items-center justify-center rounded border-2 border-[var(--ms-rule)] bg-[var(--ms-royal)] px-5 py-2.5 font-serif text-sm font-bold uppercase tracking-wider text-white shadow-[0_0_20px_rgba(124,58,237,0.45)] transition hover:bg-[#6d28d9] disabled:opacity-60";

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
        /* Keep native calendar chip inside the field (avoids orphan box next to Save) */
        .ms-datetime {
          display: block;
          width: 100%;
          min-width: 0;
          max-width: 100%;
          box-sizing: border-box;
          padding-right: 0.25rem;
          color-scheme: dark;
        }
        .ms-datetime::-webkit-calendar-picker-indicator {
          cursor: pointer;
          opacity: 0.75;
          margin-left: 0.25rem;
          filter: invert(0.85) sepia(1) saturate(3) hue-rotate(220deg);
        }
        .ms-header-actions {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 0.75rem;
        }
        @media (min-width: 480px) {
          .ms-header-actions {
            flex-direction: row;
            align-items: flex-end;
            justify-content: space-between;
            gap: 1rem;
          }
          .ms-header-actions .ms-datetime-wrap {
            flex: 1 1 auto;
            min-width: 0;
            max-width: 18rem;
          }
          .ms-header-actions .ms-header-save {
            flex: 0 0 auto;
          }
        }
        .ms-log-row {
          border: 1px solid var(--ms-rule-soft);
          background: rgba(46, 16, 80, 0.45);
        }
        .ms-portrait {
          border: 2px solid var(--ms-rule);
          background: rgba(30, 10, 55, 0.7);
          box-shadow: inset 0 0 0 1px rgba(167, 139, 250, 0.2);
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .ms-portrait__label {
          font-family: ui-serif, Georgia, serif;
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ms-gold);
        }
        /* Vertical portrait frame (taller than wide) */
        .ms-portrait__frame {
          width: min(100%, 8.5rem);
          aspect-ratio: 2 / 3;
          height: auto;
          max-height: 12rem;
          margin: 0 auto;
          overflow: hidden;
          background: #0a0614;
          position: relative;
        }
        .ms-portrait__frame img {
          position: absolute;
          inset: 0;
        }
        .ms-crop-sliders {
          width: 100%;
          padding: 0.35rem 0.45rem 0.45rem;
          border-top: 1px solid var(--ms-rule-soft);
        }
        .ms-crop-sliders label {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.55rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--ms-ink-soft);
          margin-bottom: 0.2rem;
        }
        .ms-crop-sliders input[type="range"] {
          flex: 1;
          min-width: 0;
          accent-color: #a78bfa;
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
        .ms-dual__cols--three {
          grid-template-columns: 1fr 1fr 1fr;
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

      <form
        id="ms-checkin-form"
        onSubmit={(e) => void handleSave(e)}
        className="ms-sheet p-4 sm:p-6 md:p-7 pb-24"
      >
        <header className="relative z-[1] border-b border-[var(--ms-rule-soft)] pb-3">
          <p className="ms-ornament text-center">✦ · train station check-in · ✦</p>
          <h1 className="ms-sheet-title mt-1 text-center text-xl font-bold sm:text-2xl">
            Body Measurements
          </h1>
          <p className="mt-1 text-center font-serif text-xs italic text-[var(--ms-ink-soft)]">
            Quarterly check-in · same marks each session · Train Station
          </p>
          {hasVideo ? (
            <div className="mt-2 flex justify-center">
              <button
                type="button"
                onClick={() => setWatchAgain(true)}
                className="rounded border border-[var(--ms-rule)] bg-[var(--ms-box)] px-3 py-1 font-serif text-[11px] font-semibold text-[var(--ms-accent)] hover:bg-[rgba(124,58,237,0.35)]"
              >
                ▶ Watch how-to (optional)
              </button>
            </div>
          ) : null}
          <div className="ms-header-actions mt-3 font-serif text-sm">
            <label className="ms-datetime-wrap flex flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ms-gold)]">
                Date measured
              </span>
              <input
                type="datetime-local"
                value={measuredAtLocal}
                onChange={(e) => setMeasuredAtLocal(e.target.value)}
                disabled={saving}
                className="ms-input-line ms-datetime py-1 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={saving || Boolean(photoBusy)}
              className={`${saveButtonClass} ms-header-save`}
            >
              {saving ? "Saving…" : photoBusy ? "Wait…" : "Save"}
            </button>
          </div>
        </header>

        {/*
          3-column sheet:
          [ Identity (row-span-2) | Before | Now ]
          [ Identity              | Demo video (col-span-2) ]
          [ Tape measurements across all 3 columns ]
        */}
        <div className="relative z-[1] mt-5 grid gap-3 sm:grid-cols-3 sm:items-start">
          {/* Col 1 — identity / key (sits beside photos + video) */}
          <div className="rounded-sm border border-[var(--ms-rule-soft)] bg-[rgba(20,8,40,0.35)] p-3 sm:row-span-2">
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
            <KeyField label="Man or woman">
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                disabled={saving}
                className="ms-key__input"
              >
                <option value="">—</option>
                <option value="man">Man</option>
                <option value="woman">Woman</option>
              </select>
            </KeyField>
            <p className="mb-1 mt-2 text-[9px] font-bold uppercase tracking-wider text-[var(--ms-gold)]">
              Starting · Goal · Check-in
            </p>
            <WeightTrioField
              start={startWeightLbs}
              goal={goalWeightLbs}
              checkIn={form.weightLbs}
              onStart={setStartWeightLbs}
              onGoal={setGoalWeightLbs}
              onCheckIn={(v) => setField("weightLbs", v)}
              disabled={saving}
            />
            <div className="mt-2">
              <DualMeasureField
                field={MEASUREMENT_FIELDS.find((f) => f.id === "bodyFatPct")!}
                original={originals.bodyFatPct}
                value={form.bodyFatPct}
                onChange={(v) => setField("bodyFatPct", v)}
                originalDraft={baseline.bodyFatPct}
                onOriginalChange={(v) =>
                  setBaseline((prev) => ({ ...prev, bodyFatPct: v }))
                }
                disabled={saving}
                compact
              />
            </div>
          </div>

          {/* Col 2 — Before */}
          <div className="ms-portrait w-full overflow-hidden rounded-sm">
            <div className="flex w-full items-center justify-between border-b border-[var(--ms-rule-soft)] px-2 py-1">
              <span className="ms-portrait__label">Before</span>
              <span className="font-serif text-[9px] italic text-[var(--ms-ink-soft)]">
                vertical
              </span>
            </div>
            <div className="ms-portrait__frame">
              {beforeDisplayUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={beforeDisplayUrl}
                  alt="Before progress photo"
                  style={photoCropStyle(beforeCrop)}
                  onError={() => {
                    if (!beforePreviewLocal && beforePhotoUrl) {
                      setError(
                        "Before photo could not be displayed. Try Camera or Library again.",
                      );
                    }
                  }}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-0.5 px-2 text-center">
                  <p className="font-serif text-xs text-[var(--ms-ink-soft)]">No before yet</p>
                  <p className="text-[9px] text-[var(--ms-ink-soft)]">Portrait / full body</p>
                </div>
              )}
              {photoBusy === "before" ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/55 px-2 text-center">
                  <p className="font-serif text-[11px] font-semibold text-white">Uploading…</p>
                </div>
              ) : null}
            </div>
            {beforeDisplayUrl ? (
              beforeCropOpen ? (
                <div className="ms-crop-sliders">
                  <label>
                    L–R
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={beforeCrop.focusX}
                      onChange={(e) =>
                        setBeforeCrop((c) => ({ ...c, focusX: Number(e.target.value) }))
                      }
                    />
                  </label>
                  <label>
                    Up–Dn
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={beforeCrop.focusY}
                      onChange={(e) =>
                        setBeforeCrop((c) => ({ ...c, focusY: Number(e.target.value) }))
                      }
                    />
                  </label>
                  <label>
                    Zoom
                    <input
                      type="range"
                      min={100}
                      max={250}
                      value={Math.round(beforeCrop.zoom * 100)}
                      onChange={(e) =>
                        setBeforeCrop((c) => ({
                          ...c,
                          zoom: Number(e.target.value) / 100,
                        }))
                      }
                    />
                  </label>
                  <div className="mt-1 flex gap-1">
                    <button
                      type="button"
                      className="min-w-0 flex-1 rounded border border-[var(--ms-rule)] bg-[var(--ms-royal)]/50 px-2 py-1 font-serif text-[10px] font-semibold text-[var(--ms-ink)] disabled:opacity-60"
                      disabled={cropSaving || saving}
                      onClick={() => void saveBeforeCrop()}
                    >
                      {cropSaving ? "Saving…" : "Save crop"}
                    </button>
                    <button
                      type="button"
                      className="rounded border border-[var(--ms-rule-soft)] px-2 py-1 font-serif text-[10px] text-[var(--ms-ink-soft)]"
                      disabled={cropSaving}
                      onClick={() => setBeforeCropOpen(false)}
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full border-t border-[var(--ms-rule-soft)] px-2 py-1.5">
                  <button
                    type="button"
                    className="w-full rounded border border-[var(--ms-rule)] bg-[var(--ms-box)] px-2 py-1 font-serif text-[11px] font-semibold text-[var(--ms-ink)] hover:bg-[rgba(124,58,237,0.35)]"
                    onClick={() => setBeforeCropOpen(true)}
                  >
                    Crop
                  </button>
                </div>
              )
            ) : null}
            <div className="flex w-full flex-col gap-1 border-t border-[var(--ms-rule-soft)] px-2 py-1.5">
              <input
                ref={beforeCameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => void uploadPortrait("before", e.target.files)}
              />
              <input
                ref={beforeLibraryRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
                className="hidden"
                onChange={(e) => void uploadPortrait("before", e.target.files)}
              />
              <button
                type="button"
                className="w-full rounded border border-[var(--ms-rule)] bg-[var(--ms-box)] px-2 py-1 font-serif text-[11px] font-semibold text-[var(--ms-ink)] hover:bg-[rgba(124,58,237,0.35)] disabled:opacity-60"
                disabled={Boolean(photoBusy) || saving}
                onClick={() => beforeCameraRef.current?.click()}
              >
                {photoBusy === "before" ? "Uploading…" : "📷 Take photo"}
              </button>
              <button
                type="button"
                className="w-full rounded border border-[var(--ms-rule)] bg-[var(--ms-box)] px-2 py-1 font-serif text-[11px] font-semibold text-[var(--ms-ink)] hover:bg-[rgba(124,58,237,0.35)] disabled:opacity-60"
                disabled={Boolean(photoBusy) || saving}
                onClick={() => beforeLibraryRef.current?.click()}
              >
                {photoBusy === "before" ? "…" : "🖼 Library"}
              </button>
            </div>
          </div>

          {/* Col 3 — Now */}
          <div className="ms-portrait w-full overflow-hidden rounded-sm">
            <div className="flex w-full items-center justify-between border-b border-[var(--ms-rule-soft)] px-2 py-1">
              <span className="ms-portrait__label">Now</span>
              <span className="font-serif text-[9px] italic text-[var(--ms-ink-soft)]">
                this check-in
              </span>
            </div>
            <div className="ms-portrait__frame">
              {nowDisplayUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={nowDisplayUrl}
                  alt="Current progress photo"
                  style={photoCropStyle(nowCrop)}
                  onError={() => {
                    if (!nowPreviewLocal && nowPhotoUrl) {
                      setError(
                        "Now photo could not be displayed. Try Camera or Library again.",
                      );
                    }
                  }}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-0.5 px-2 text-center">
                  <p className="font-serif text-xs text-[var(--ms-ink-soft)]">Today&apos;s photo</p>
                  <p className="text-[9px] text-[var(--ms-ink-soft)]">Portrait / full body</p>
                </div>
              )}
              {photoBusy === "now" ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/55 px-2 text-center">
                  <p className="font-serif text-[11px] font-semibold text-white">Uploading…</p>
                </div>
              ) : null}
            </div>
            {nowDisplayUrl ? (
              nowCropOpen ? (
                <div className="ms-crop-sliders">
                  <label>
                    L–R
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={nowCrop.focusX}
                      onChange={(e) =>
                        setNowCrop((c) => ({ ...c, focusX: Number(e.target.value) }))
                      }
                    />
                  </label>
                  <label>
                    Up–Dn
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={nowCrop.focusY}
                      onChange={(e) =>
                        setNowCrop((c) => ({ ...c, focusY: Number(e.target.value) }))
                      }
                    />
                  </label>
                  <label>
                    Zoom
                    <input
                      type="range"
                      min={100}
                      max={250}
                      value={Math.round(nowCrop.zoom * 100)}
                      onChange={(e) =>
                        setNowCrop((c) => ({
                          ...c,
                          zoom: Number(e.target.value) / 100,
                        }))
                      }
                    />
                  </label>
                  <p className="mt-0.5 text-center text-[9px] text-[var(--ms-ink-soft)]">
                    Crop applies on Save check-in
                  </p>
                  <button
                    type="button"
                    className="mt-1 w-full rounded border border-[var(--ms-rule)] bg-[var(--ms-box)] px-2 py-1 font-serif text-[10px] font-semibold text-[var(--ms-ink)]"
                    onClick={() => setNowCropOpen(false)}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div className="w-full border-t border-[var(--ms-rule-soft)] px-2 py-1.5">
                  <button
                    type="button"
                    className="w-full rounded border border-[var(--ms-rule)] bg-[var(--ms-box)] px-2 py-1 font-serif text-[11px] font-semibold text-[var(--ms-ink)] hover:bg-[rgba(124,58,237,0.35)]"
                    onClick={() => setNowCropOpen(true)}
                  >
                    Crop
                  </button>
                </div>
              )
            ) : null}
            <div className="flex w-full flex-col gap-1 border-t border-[var(--ms-rule-soft)] px-2 py-1.5">
              <input
                ref={nowCameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => void uploadPortrait("now", e.target.files)}
              />
              <input
                ref={nowLibraryRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
                className="hidden"
                onChange={(e) => void uploadPortrait("now", e.target.files)}
              />
              <div className="flex gap-1">
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded border border-[var(--ms-rule)] bg-[var(--ms-box)] px-2 py-1 font-serif text-[11px] font-semibold text-[var(--ms-ink)] hover:bg-[rgba(124,58,237,0.35)] disabled:opacity-60"
                  disabled={Boolean(photoBusy) || saving}
                  onClick={() => nowCameraRef.current?.click()}
                >
                  {photoBusy === "now" ? "…" : "📷 Camera"}
                </button>
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded border border-[var(--ms-rule)] bg-[var(--ms-box)] px-2 py-1 font-serif text-[11px] font-semibold text-[var(--ms-ink)] hover:bg-[rgba(124,58,237,0.35)] disabled:opacity-60"
                  disabled={Boolean(photoBusy) || saving}
                  onClick={() => nowLibraryRef.current?.click()}
                >
                  {photoBusy === "now" ? "…" : "🖼 Library"}
                </button>
                {nowDisplayUrl ? (
                  <button
                    type="button"
                    className="rounded border border-fuchsia-400/30 px-2 py-1 font-serif text-[11px] text-fuchsia-200"
                    onClick={() => {
                      setNowPhotoUrl(null);
                      setNowPreviewLocal((prev) => {
                        if (prev) URL.revokeObjectURL(prev);
                        return null;
                      });
                      setNowCrop({ ...DEFAULT_PHOTO_CROP });
                      setNowCropOpen(false);
                    }}
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Demo video — columns 2–3, flush under Before / Now */}
          <div className="ms-video-frame overflow-hidden rounded-sm sm:col-span-2">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--ms-rule-soft)] bg-[#12081f] px-2 py-1">
              <span className="ms-video-label">Demonstration · How to measure</span>
              {hasVideo ? (
                <button
                  type="button"
                  className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ms-accent)] underline-offset-2 hover:underline"
                  onClick={() => setWatchAgain(true)}
                >
                  Watch again
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
                  {isYt ? "Watch again · full player →" : "Watch again · full-screen →"}
                </button>
              </div>
            ) : null}
          </div>

          {/* Tape measurements — full width, all 3 columns */}
          <div className="min-w-0 sm:col-span-3">
            <h2 className="ms-section-label">Measurements · Tape (inches)</h2>
            <p className="mb-2 font-serif text-[11px] italic text-[var(--ms-ink-soft)]">
              Each tape field: <strong className="text-[var(--ms-gold)]">Starting</strong> (left —
              type here if it&apos;s still blank) ·{" "}
              <strong className="text-[var(--ms-gold)]">Check-in</strong> (today, right).
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {TAPE_MEASUREMENT_FIELDS.map((field) => (
                <DualMeasureField
                  key={field.id}
                  field={field}
                  original={originals[field.id]}
                  value={form[field.id]}
                  onChange={(v) => setField(field.id, v)}
                  originalDraft={baseline[field.id]}
                  onOriginalChange={(v) =>
                    setBaseline((prev) => ({ ...prev, [field.id]: v }))
                  }
                  disabled={saving}
                />
              ))}
            </div>
          </div>
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
          <div
            ref={formSaveRef}
            className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-[var(--ms-rule)] bg-[rgba(30,16,60,0.55)] px-3 py-3 sm:px-4"
          >
            <button
              type="submit"
              disabled={saving || Boolean(photoBusy)}
              className={saveButtonClass}
            >
              {saving ? "Saving…" : photoBusy ? "Wait for photo…" : "Save check-in"}
            </button>
            <p className="min-w-0 flex-1 font-serif text-[11px] italic text-[var(--ms-ink-soft)] sm:text-xs">
              {saving
                ? "Saving your check-in…"
                : message
                  ? message
                  : "Save starting + goal anytime. Check-in is this visit."}
            </p>
          </div>
        </div>

        <p className="ms-ornament relative z-[1] mt-6 text-center">✦ · end of sheet · ✦</p>
      </form>

      {/* Floating Save — only until first Save press this visit, then docks to form footer */}
      {floatSave ? (
        <div className="sticky bottom-3 z-20 mx-auto max-w-4xl px-1 pb-[env(safe-area-inset-bottom)]">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-[var(--ms-rule)] bg-[rgba(30,16,60,0.95)] px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur">
            <p className="font-serif text-xs text-[var(--ms-ink-soft)] sm:text-sm">
              {saving
                ? "Saving your check-in…"
                : photoBusy
                  ? "Uploading photo…"
                  : message
                    ? message
                    : "Enter check-in numbers (right column), then save."}
            </p>
            <button
              type="button"
              disabled={saving || Boolean(photoBusy)}
              className={saveButtonClass}
              onClick={() => void saveCheckIn()}
            >
              {saving ? "Saving…" : photoBusy ? "Wait…" : "Save"}
            </button>
          </div>
        </div>
      ) : null}

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
            {freeExplorer && rows.length > 1 ? (
              <li className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 font-serif text-xs text-[var(--ms-ink-soft)]">
                Free Explorer keeps your latest check-in clear. Full adventure log history is Coach
                Class+.
              </li>
            ) : null}
            {(freeExplorer ? rows.slice(0, 1) : rows).map((row) => (
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
                    <div className="h-14 w-10 shrink-0 overflow-hidden rounded ring-1 ring-[var(--ms-rule-soft)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={row.photoUrl}
                        alt="Check-in photo"
                        style={photoCropStyle(
                          normalizePhotoCrop({
                            focusX: row.photoFocusX,
                            focusY: row.photoFocusY,
                            zoom: row.photoZoom,
                          }),
                        )}
                      />
                    </div>
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
