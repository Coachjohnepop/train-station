"use client";

import { useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import {
  saveLandingMediaAction,
  saveMemberContentAction,
} from "@/app/admin/landing/actions";
import PlayableVideoFrame from "@/components/PlayableVideoFrame";
import YoutubeAutoplayFrame from "@/components/YoutubeAutoplayFrame";
import {
  assignmentsFromLanding,
  COACH_INTRO_SLOTS,
  setSlotUrl,
  urlForSlot,
  type CoachIntroAssignments,
  type CoachIntroSlotId,
} from "@/lib/coach-intro-slots";
import {
  FREE_TICKET_GAG_SRC,
  FREE_TICKET_RICKROLL_DURATION_MS,
} from "@/lib/landing-media";
import type { WelcomeVideosByPlan } from "@/lib/landing-media-store";
import type {
  DailyInspirationClip,
  NutritionCalorieTier,
} from "@/lib/member-content-store";
import type { SiteVideoLibraryItem } from "@/lib/site-video-library-store";
import {
  isAllowedCoachIntroVideoUrl,
  SITE_VIDEO_MAX_BYTES,
  siteVideoExtFromMime,
  siteVideoMimeFromName,
} from "@/lib/site-video";
import { isYoutubeUrl } from "@/lib/youtube";
import {
  clampVolumeDb,
  DEFAULT_UPLOADED_CONTENT_VOLUME_DB,
  formatVolumeDbLabel,
  VOLUME_DB_MAX,
  VOLUME_DB_MIN,
  VOLUME_DB_STEP,
} from "@/lib/media-volume";

const WEEKDAYS = [
  { value: "", label: "Any day" },
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

const MAX_MB = Math.round(SITE_VIDEO_MAX_BYTES / (1024 * 1024));

function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  if (!base) return "Untitled video";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** YouTube-only field (thank-you, weekly, dinner, daily). */
function YoutubeVideoField({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const preview = value.trim() && isYoutubeUrl(value) ? value.trim() : null;
  const [watching, setWatching] = useState(false);
  return (
    <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <label className="block text-sm font-semibold text-[var(--text)]">{label}</label>
        {preview ? (
          <button
            type="button"
            className="btn-ghost px-2 py-1 text-xs font-semibold"
            onClick={() => setWatching((v) => !v)}
          >
            {watching ? "Hide player" : "Watch"}
          </button>
        ) : null}
      </div>
      {hint ? <p className="text-xs text-[var(--muted)]">{hint}</p> : null}
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "https://www.youtube.com/watch?v=… or youtu.be/…"}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
      />
      {watching && preview ? (
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-black">
          <YoutubeAutoplayFrame
            className="aspect-video w-full max-h-[28rem]"
            videoUrl={preview}
            title={label}
            autoplay={false}
            duckBackgroundMusic
          />
        </div>
      ) : null}
    </div>
  );
}

function libraryLabel(items: SiteVideoLibraryItem[], url: string): string {
  const hit = items.find((i) => i.url === url);
  if (hit) return hit.title;
  if (!url) return "— none —";
  if (isYoutubeUrl(url)) return "YouTube clip";
  return "Uploaded video";
}

export default function AdminSiteVideosPanel({
  initialWelcomeUrl = "",
  initialWelcomeVideosByPlan = {},
  initialFreeUrl = "",
  initialGagUrl = "",
  initialGagStartSec = 43,
  initialGagDurationSec = 5,
  initialGagEnabled = true,
  initialPurchaseThankYouUrl = "",
  initialEquipmentIntroUrl = "",
  initialMeasurementsIntroUrl = "",
  initialWeeklyUrl = "",
  initialWeeklyTitle = "",
  initialDinnerUrl = "",
  initialDinnerTitle = "",
  initialDailyClips = [],
  initialNutritionIntro = "",
  initialNutritionTiers = [],
  initialLibrary = [],
  initialUploadedContentVolumeDb = DEFAULT_UPLOADED_CONTENT_VOLUME_DB,
}: {
  initialWelcomeUrl?: string;
  initialWelcomeVideosByPlan?: WelcomeVideosByPlan;
  initialFreeUrl?: string;
  initialGagUrl?: string;
  initialGagStartSec?: number;
  initialGagDurationSec?: number;
  initialGagEnabled?: boolean;
  initialPurchaseThankYouUrl?: string;
  initialEquipmentIntroUrl?: string;
  initialMeasurementsIntroUrl?: string;
  initialWeeklyUrl?: string;
  initialWeeklyTitle?: string;
  initialDinnerUrl?: string;
  initialDinnerTitle?: string;
  initialDailyClips?: DailyInspirationClip[];
  initialNutritionIntro?: string;
  initialNutritionTiers?: NutritionCalorieTier[];
  initialLibrary?: SiteVideoLibraryItem[];
  initialUploadedContentVolumeDb?: number;
}) {
  const [library, setLibrary] = useState<SiteVideoLibraryItem[]>(initialLibrary);
  const [volumeDb, setVolumeDb] = useState(() =>
    clampVolumeDb(initialUploadedContentVolumeDb, DEFAULT_UPLOADED_CONTENT_VOLUME_DB),
  );
  const [assignments, setAssignments] = useState<CoachIntroAssignments>(() =>
    assignmentsFromLanding({
      welcomeVideoUrl: initialWelcomeUrl,
      freeChastiseVideoUrl: initialFreeUrl,
      equipmentIntroVideoUrl: initialEquipmentIntroUrl,
      measurementsIntroVideoUrl: initialMeasurementsIntroUrl,
      welcomeVideosByPlan: initialWelcomeVideosByPlan,
    }),
  );
  const [gagEnabled, setGagEnabled] = useState(initialGagEnabled);
  const [purchaseUrl, setPurchaseUrl] = useState(initialPurchaseThankYouUrl);
  const [weeklyUrl, setWeeklyUrl] = useState(initialWeeklyUrl);
  const [weeklyTitle, setWeeklyTitle] = useState(initialWeeklyTitle);
  const [dinnerUrl, setDinnerUrl] = useState(initialDinnerUrl);
  const [dinnerTitle, setDinnerTitle] = useState(initialDinnerTitle);
  const [clips, setClips] = useState<DailyInspirationClip[]>(initialDailyClips);
  const [nutritionIntro] = useState(initialNutritionIntro);
  const [tiers] = useState(initialNutritionTiers);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const replaceFileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const slotFileRefs = useRef<Partial<Record<CoachIntroSlotId, HTMLInputElement | null>>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  /** Slot ids currently showing the admin Watch player. */
  const [watchingSlots, setWatchingSlots] = useState<Partial<Record<CoachIntroSlotId, boolean>>>(
    {},
  );
  const [watchingGag, setWatchingGag] = useState(false);
  const [slotUploading, setSlotUploading] = useState<CoachIntroSlotId | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);

  const usedUrls = useMemo(() => {
    const set = new Set<string>();
    const overall = assignments.overall.trim();
    const free = assignments.free.trim();
    const equipment = assignments.equipment.trim();
    const measurements = assignments.measurements.trim();
    if (overall) set.add(overall);
    if (free) set.add(free);
    if (equipment) set.add(equipment);
    if (measurements) set.add(measurements);
    for (const url of Object.values(assignments.byPlan)) {
      if (url?.trim()) set.add(url.trim());
    }
    return set;
  }, [assignments]);

  function assignSlot(slotId: CoachIntroSlotId, url: string) {
    setAssignments((prev) => setSlotUrl(prev, slotId, url));
  }

  function slotsUsingUrl(url: string): string[] {
    if (!url) return [];
    return COACH_INTRO_SLOTS.filter((s) => urlForSlot(s.id, assignments) === url).map(
      (s) => s.label,
    );
  }

  async function registerInLibrary(params: {
    url: string;
    title: string;
    fileName?: string;
  }): Promise<SiteVideoLibraryItem | null> {
    const res = await fetch("/api/admin/site-videos/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add",
        url: params.url,
        title: params.title,
        fileName: params.fileName,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      item?: SiteVideoLibraryItem;
      error?: string;
    };
    if (!res.ok || !data.item) {
      throw new Error(data.error || "Could not add video to library.");
    }
    setLibrary((prev) => {
      const without = prev.filter((i) => i.id !== data.item!.id && i.url !== data.item!.url);
      return [data.item!, ...without];
    });
    return data.item;
  }

  async function putFileToBlob(
    file: File,
    progressLabel: string,
  ): Promise<string> {
    if (file.size > SITE_VIDEO_MAX_BYTES) {
      throw new Error(`${file.name}: too large (max ${MAX_MB} MB).`);
    }
    setUploadProgress(progressLabel);
    const mime = file.type || siteVideoMimeFromName(file.name);
    const ext = siteVideoExtFromMime(mime);
    const pathname = `site-videos/${crypto.randomUUID()}.${ext}`;
    let url: string | null = null;

    try {
      const blob = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/admin/landing-media/upload",
        contentType: mime,
        multipart: file.size > 4 * 1024 * 1024,
        onUploadProgress: (p) => {
          setUploadProgress(`${progressLabel} (${Math.round(p.percentage)}%)`);
        },
      });
      url = blob.url;
    } catch (clientErr) {
      if (file.size > 4.5 * 1024 * 1024) {
        throw clientErr instanceof Error
          ? clientErr
          : new Error(`${file.name}: client upload failed.`);
      }
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/landing-media/upload", {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !data.url) {
        throw new Error(data.error || `${file.name}: upload failed`);
      }
      url = data.url;
    }

    if (!url) throw new Error(`${file.name}: no URL returned`);
    return url;
  }

  async function uploadOneFile(
    file: File,
    index: number,
    total: number,
    titleOverride?: string,
  ): Promise<SiteVideoLibraryItem> {
    const url = await putFileToBlob(
      file,
      `Uploading ${index + 1} of ${total}: ${file.name}`,
    );
    const item = await registerInLibrary({
      url,
      title: titleOverride || titleFromFileName(file.name),
      fileName: file.name,
    });
    if (!item) throw new Error(`${file.name}: could not add to library`);
    return item;
  }

  function reassignUrlEverywhere(oldUrl: string, newUrl: string) {
    if (!oldUrl || oldUrl === newUrl) return;
    setAssignments((prev) => {
      let next = { ...prev, byPlan: { ...prev.byPlan } };
      for (const slot of COACH_INTRO_SLOTS) {
        if (urlForSlot(slot.id, next) === oldUrl) {
          next = setSlotUrl(next, slot.id, newUrl);
        }
      }
      return next;
    });
  }

  async function handleMultiUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setUploadError(null);
    setUploadProgress(null);
    const list = Array.from(files);
    try {
      let last: SiteVideoLibraryItem | null = null;
      for (let i = 0; i < list.length; i++) {
        last = await uploadOneFile(list[i], i, list.length);
      }
      setUploadProgress(`Added ${list.length} video${list.length === 1 ? "" : "s"} to library.`);
      if (last) setPreviewId(last.id);
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
      setUploadProgress(null);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /** Persist intro slot URLs to landing media immediately (so members see them without a full Save). */
  async function publishIntroSlots(next: CoachIntroAssignments) {
    const freeExplorerUrl = next.free.trim() || null;
    const byPlan = {
      ...next.byPlan,
      explorer: freeExplorerUrl,
    };
    const landingResult = await saveLandingMediaAction({
      welcomeVideoUrl: next.overall.trim() || null,
      welcomeVideosByPlan: byPlan,
      freeChastiseVideoUrl: freeExplorerUrl,
      equipmentIntroVideoUrl: next.equipment.trim() || null,
      measurementsIntroVideoUrl: next.measurements.trim() || null,
      gagEnabled,
      uploadedContentVolumeDb: volumeDb,
    });
    if ("error" in landingResult && landingResult.error) {
      throw new Error(landingResult.error);
    }
    if ("ok" in landingResult && landingResult.ok) {
      setAssignments(
        assignmentsFromLanding({
          welcomeVideoUrl: landingResult.storedWelcomeVideoUrl,
          freeChastiseVideoUrl: landingResult.storedFreeChastiseVideoUrl,
          equipmentIntroVideoUrl: landingResult.storedEquipmentIntroVideoUrl,
          measurementsIntroVideoUrl: landingResult.storedMeasurementsIntroVideoUrl,
          welcomeVideosByPlan: landingResult.storedWelcomeVideosByPlan,
        }),
      );
    }
  }

  /** Upload a file and assign it to one intro slot (or replace that slot’s file). */
  async function handleSlotUpload(slotId: CoachIntroSlotId, files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const slot = COACH_INTRO_SLOTS.find((s) => s.id === slotId);
    const label = slot?.label || "slot";
    setSlotUploading(slotId);
    setUploadError(null);
    setUploadProgress(null);
    try {
      const currentUrl = urlForSlot(slotId, assignments);
      const existing = library.find((i) => i.url === currentUrl);
      let assignedUrl = "";
      if (existing) {
        // Replace the library row in place so title/slot mapping stay put.
        const url = await putFileToBlob(file, `Replacing ${label}: ${file.name}`);
        const res = await fetch("/api/admin/site-videos/library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "replace",
            id: existing.id,
            url,
            fileName: file.name,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          item?: SiteVideoLibraryItem;
          previousUrl?: string | null;
          error?: string;
        };
        if (!res.ok || !data.item) {
          throw new Error(data.error || "Replace failed");
        }
        setLibrary((prev) =>
          prev.map((i) => (i.id === data.item!.id ? data.item! : i)),
        );
        reassignUrlEverywhere(data.previousUrl || existing.url, data.item.url);
        assignSlot(slotId, data.item.url);
        assignedUrl = data.item.url;
        setPreviewId(data.item.id);
      } else {
        const item = await uploadOneFile(file, 0, 1, label);
        assignSlot(slotId, item.url);
        assignedUrl = item.url;
        setPreviewId(item.id);
      }
      const nextAssignments = setSlotUrl(assignments, slotId, assignedUrl);
      setAssignments(nextAssignments);
      setWatchingSlots((prev) => ({ ...prev, [slotId]: true }));
      setUploadProgress(`${label}: publishing to live site…`);
      await publishIntroSlots(nextAssignments);
      setUploadProgress(`${label}: live on the site.`);
      setMessage(`${label} published — members will see it on the next page load.`);
      setError(false);
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
      setUploadProgress(null);
    } finally {
      setSlotUploading(null);
      const input = slotFileRefs.current[slotId];
      if (input) input.value = "";
    }
  }

  /** Replace the file on an existing library row; slots using the old URL follow. */
  async function handleLibraryReplace(itemId: string, files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const old = library.find((i) => i.id === itemId);
    if (!old) return;
    setReplacingId(itemId);
    setUploading(true);
    setUploadError(null);
    try {
      const url = await putFileToBlob(file, `Replacing “${old.title}”: ${file.name}`);
      const res = await fetch("/api/admin/site-videos/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "replace",
          id: itemId,
          url,
          fileName: file.name,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        item?: SiteVideoLibraryItem;
        previousUrl?: string | null;
        error?: string;
      };
      if (!res.ok || !data.item) {
        throw new Error(data.error || "Replace failed");
      }
      setLibrary((prev) => prev.map((i) => (i.id === data.item!.id ? data.item! : i)));
      reassignUrlEverywhere(data.previousUrl || old.url, data.item.url);
      setPreviewId(data.item.id);
      setUploadProgress(`Replaced “${data.item.title}”. Save all videos if slots need publishing.`);
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : "Replace failed");
      setUploadProgress(null);
    } finally {
      setReplacingId(null);
      setUploading(false);
      const input = replaceFileRefs.current[itemId];
      if (input) input.value = "";
    }
  }

  async function renameLibraryItem(id: string, title: string) {
    setLibrary((prev) => prev.map((i) => (i.id === id ? { ...i, title } : i)));
    try {
      await fetch("/api/admin/site-videos/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rename", id, title }),
      });
    } catch {
      /* local title already updated; save rename best-effort */
    }
  }

  async function removeLibraryItem(id: string) {
    const item = library.find((i) => i.id === id);
    if (!item) return;
    const used = slotsUsingUrl(item.url);
    if (used.length) {
      const ok = window.confirm(
        `“${item.title}” is assigned to: ${used.join(", ")}.\n\nRemove from library anyway? Those slots will keep the URL until you change them.`,
      );
      if (!ok) return;
    } else if (!window.confirm(`Remove “${item.title}” from the library?`)) {
      return;
    }

    setLibrary((prev) => prev.filter((i) => i.id !== id));
    if (previewId === id) setPreviewId(null);
    await fetch(`/api/admin/site-videos/library?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }).catch(() => null);
  }

  function addClip() {
    setClips((prev) => [
      ...prev,
      {
        id: `insp-${Date.now().toString(36)}`,
        title: "Daily inspiration",
        videoUrl: "",
        weekday: null,
      },
    ]);
  }

  function updateClip(index: number, patch: Partial<DailyInspirationClip>) {
    setClips((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function removeClip(index: number) {
    setClips((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setError(false);

    const yt = (url: string, label: string) => {
      const t = url.trim();
      if (t && !isYoutubeUrl(t)) {
        setError(true);
        setMessage(`${label} must be a YouTube link (youtube.com or youtu.be).`);
        return false;
      }
      return true;
    };

    const introOk = (url: string, label: string) => {
      const t = url.trim();
      if (t && !isAllowedCoachIntroVideoUrl(t)) {
        setError(true);
        setMessage(`${label} must be an uploaded site file (MP4/WebM/MOV).`);
        return false;
      }
      return true;
    };

    if (!introOk(assignments.overall, "Overall intro")) {
      setSaving(false);
      return;
    }
    if (!introOk(assignments.free, "Free Explorer intro")) {
      setSaving(false);
      return;
    }
    if (!introOk(assignments.equipment, "Gear / equipment intro")) {
      setSaving(false);
      return;
    }
    if (!introOk(assignments.measurements, "Measurements how-to")) {
      setSaving(false);
      return;
    }
    for (const slot of COACH_INTRO_SLOTS) {
      if (
        slot.id === "overall" ||
        slot.id === "free" ||
        slot.id === "equipment" ||
        slot.id === "measurements"
      ) {
        continue;
      }
      const url = urlForSlot(slot.id, assignments);
      if (url && !isAllowedCoachIntroVideoUrl(url)) {
        setError(true);
        setMessage(`${slot.label} must be an uploaded site file (MP4/WebM/MOV).`);
        setSaving(false);
        return;
      }
    }
    if (!yt(purchaseUrl, "Purchase thank-you video")) {
      setSaving(false);
      return;
    }
    if (!yt(weeklyUrl, "Weekly coach video")) {
      setSaving(false);
      return;
    }
    if (!yt(dinnerUrl, "Dinner video")) {
      setSaving(false);
      return;
    }
    for (let i = 0; i < clips.length; i++) {
      const c = clips[i];
      if (c.videoUrl.trim() && !isYoutubeUrl(c.videoUrl)) {
        setError(true);
        setMessage(`Daily clip #${i + 1} must be a YouTube link.`);
        setSaving(false);
        return;
      }
    }

    // One Free Explorer clip → free-ticket modal after gag + Free Explorer onboard
    const freeExplorerUrl = assignments.free.trim() || null;
    const byPlan = {
      ...assignments.byPlan,
      explorer: freeExplorerUrl,
    };

    const landingResult = await saveLandingMediaAction({
      welcomeVideoUrl: assignments.overall.trim() || null,
      welcomeVideosByPlan: byPlan,
      freeChastiseVideoUrl: freeExplorerUrl,
      // Product Free path: fixed 5s Rickroll (never persist custom Shorts / long gag).
      gagVideoUrl: null,
      gagStartSec: 0,
      gagDurationSec: 5,
      gagEnabled,
      purchaseThankYouVideoUrl: purchaseUrl.trim() || null,
      equipmentIntroVideoUrl: assignments.equipment.trim() || null,
      measurementsIntroVideoUrl: assignments.measurements.trim() || null,
      uploadedContentVolumeDb: volumeDb,
    });

    if ("error" in landingResult && landingResult.error) {
      setError(true);
      setMessage(landingResult.error);
      setSaving(false);
      return;
    }

    const memberResult = await saveMemberContentAction({
      weeklyVideoUrl: weeklyUrl.trim() || null,
      weeklyVideoTitle: weeklyTitle.trim(),
      dinnerVideoUrl: dinnerUrl.trim() || null,
      dinnerVideoTitle: dinnerTitle.trim(),
      dailyInspirationClips: clips.filter((c) => c.videoUrl.trim()),
      nutritionIntro,
      nutritionTiers: tiers,
    });

    if ("error" in memberResult && memberResult.error) {
      setError(true);
      setMessage(memberResult.error);
      setSaving(false);
      return;
    }

    if ("ok" in landingResult && landingResult.ok) {
      setAssignments(
        assignmentsFromLanding({
          welcomeVideoUrl: landingResult.storedWelcomeVideoUrl,
          freeChastiseVideoUrl: landingResult.storedFreeChastiseVideoUrl,
          equipmentIntroVideoUrl: landingResult.storedEquipmentIntroVideoUrl,
          measurementsIntroVideoUrl: landingResult.storedMeasurementsIntroVideoUrl,
          welcomeVideosByPlan: landingResult.storedWelcomeVideosByPlan,
        }),
      );
      setGagEnabled(landingResult.storedGagEnabled !== false);
      setPurchaseUrl(landingResult.storedPurchaseThankYouVideoUrl || "");
      if (landingResult.storedUploadedContentVolumeDb != null) {
        setVolumeDb(
          clampVolumeDb(
            landingResult.storedUploadedContentVolumeDb,
            DEFAULT_UPLOADED_CONTENT_VOLUME_DB,
          ),
        );
      }
    }
    if ("ok" in memberResult && memberResult.ok) {
      setWeeklyUrl(memberResult.storedWeeklyVideoUrl || "");
      setWeeklyTitle(memberResult.storedWeeklyVideoTitle || "");
      setDinnerUrl(memberResult.storedDinnerVideoUrl || "");
      setDinnerTitle(memberResult.storedDinnerVideoTitle || "");
      if (memberResult.storedDailyInspirationClips) {
        setClips(memberResult.storedDailyInspirationClips);
      }
    }

    setMessage("Saved — library assignments are live on the site.");
    setError(false);
    setSaving(false);
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4 text-sm text-[var(--muted)]">
        <p className="font-semibold text-violet-100">Site video desk</p>
        <p className="mt-1">
          <strong className="text-[var(--text)]">Upload / Replace</strong> on each intro slot, or
          bulk-upload into the library and assign.{" "}
          <strong className="text-[var(--text)]">Watch</strong> plays the clip here so you can check
          it before Save. Free guests still get the fixed ~5s Rickroll gag first, then{" "}
          <strong className="text-[var(--text)]">Free Explorer intro</strong>.
        </p>
      </div>

      {/* —— Uploaded content volume —— */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-lg font-semibold">Playback volume · uploaded intros</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Relative to native file volume, in <strong className="text-[var(--text)]">3 dB</strong>{" "}
          steps. Applies to overall / free / plan / gear intros (uploaded site files). Default is
          +6 dB so intros cut through.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-ghost rounded-full px-4 py-2 text-sm font-bold"
            disabled={volumeDb <= VOLUME_DB_MIN}
            onClick={() =>
              setVolumeDb((v) =>
                clampVolumeDb(v - VOLUME_DB_STEP, DEFAULT_UPLOADED_CONTENT_VOLUME_DB),
              )
            }
            aria-label="Quieter by 3 dB"
          >
            − 3 dB
          </button>
          <div className="min-w-[8rem] text-center">
            <p className="text-lg font-bold tabular-nums text-[var(--text)]">
              {formatVolumeDbLabel(volumeDb)}
            </p>
            <p className="text-[10px] text-[var(--muted)]">
              {VOLUME_DB_MIN} … +{VOLUME_DB_MAX} dB
            </p>
          </div>
          <button
            type="button"
            className="btn-ghost rounded-full px-4 py-2 text-sm font-bold"
            disabled={volumeDb >= VOLUME_DB_MAX}
            onClick={() =>
              setVolumeDb((v) =>
                clampVolumeDb(v + VOLUME_DB_STEP, DEFAULT_UPLOADED_CONTENT_VOLUME_DB),
              )
            }
            aria-label="Louder by 3 dB"
          >
            + 3 dB
          </button>
          <button
            type="button"
            className="text-xs font-semibold text-[var(--accent)] underline"
            onClick={() => setVolumeDb(0)}
          >
            Reset to native
          </button>
        </div>
      </section>

      {/* —— Library + assignments —— */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">1 · Jeremy&apos;s video library</h2>
            <p className="text-xs text-[var(--muted)]">
              Upload several MP4 / WebM / MOV files (max {MAX_MB} MB each). Name them, then pick
              where each goes below.
            </p>
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v"
              multiple
              className="hidden"
              onChange={(e) => void handleMultiUpload(e.target.files)}
            />
            <button
              type="button"
              className="btn-primary px-4 py-2 text-sm font-semibold"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? "Uploading…" : "Upload videos"}
            </button>
          </div>
        </div>

        {uploadProgress ? (
          <p className="text-xs text-emerald-300">{uploadProgress}</p>
        ) : null}
        {uploadError ? <p className="text-xs text-red-300">{uploadError}</p> : null}

        {library.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[var(--muted)]">
            No library videos yet. Upload Jeremy&apos;s overall intro, Coach Class intro, Business
            intro, Free Explorer clip, etc. — then assign them in section 2.
          </p>
        ) : (
          <ul className="space-y-3">
            {library.map((item) => {
              const used = slotsUsingUrl(item.url);
              const open = previewId === item.id;
              return (
                <li
                  key={item.id}
                  className="rounded-xl border border-emerald-500/20 bg-[var(--surface)] p-4"
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <input
                        value={item.title}
                        onChange={(e) =>
                          setLibrary((prev) =>
                            prev.map((i) =>
                              i.id === item.id ? { ...i, title: e.target.value } : i,
                            ),
                          )
                        }
                        onBlur={(e) => void renameLibraryItem(item.id, e.target.value)}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm font-semibold"
                        placeholder="Video name"
                      />
                      <p className="truncate text-[11px] text-[var(--muted)]" title={item.url}>
                        {item.fileName ? `${item.fileName} · ` : ""}
                        {item.url}
                      </p>
                      {used.length ? (
                        <p className="text-[11px] text-emerald-300/90">
                          Assigned to: {used.join(" · ")}
                        </p>
                      ) : (
                        <p className="text-[11px] text-amber-200/80">
                          Not assigned yet — pick a slot below.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-ghost text-xs font-semibold"
                        onClick={() => setPreviewId(open ? null : item.id)}
                      >
                        {open ? "Hide player" : "Watch"}
                      </button>
                      <input
                        ref={(el) => {
                          replaceFileRefs.current[item.id] = el;
                        }}
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v"
                        className="hidden"
                        onChange={(e) => void handleLibraryReplace(item.id, e.target.files)}
                      />
                      <button
                        type="button"
                        className="btn-ghost text-xs font-semibold"
                        disabled={uploading || replacingId === item.id}
                        onClick={() => replaceFileRefs.current[item.id]?.click()}
                      >
                        {replacingId === item.id ? "Replacing…" : "Replace video"}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost text-xs text-red-300"
                        onClick={() => void removeLibraryItem(item.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  {open ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-[11px] text-[var(--muted)]">
                        Admin player — use native controls (play / scrub / volume).
                      </p>
                      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-black">
                        <PlayableVideoFrame
                          key={`${item.id}:${item.url}`}
                          className="aspect-video w-full max-h-[28rem]"
                          videoUrl={item.url}
                          title={item.title}
                          volumeDb={volumeDb}
                          autoplay={false}
                          duckBackgroundMusic
                        />
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">2 · Where each one goes</h2>
        <p className="text-xs text-[var(--muted)]">
          Upload or replace directly on a slot, or pick an existing library clip. Use{" "}
          <strong className="text-[var(--text)]">Watch</strong> to play it here. Free Explorer is the
          Jeremy clip after the Free-ticket gag.
        </p>
        <div className="space-y-3">
          {COACH_INTRO_SLOTS.map((slot) => {
            const currentUrl = urlForSlot(slot.id, assignments);
            const selectValue =
              library.find((i) => i.url === currentUrl)?.id ||
              (currentUrl ? "__custom__" : "");
            const watching = Boolean(watchingSlots[slot.id]);
            const busy = slotUploading === slot.id;
            const hasVideo = Boolean(currentUrl && isAllowedCoachIntroVideoUrl(currentUrl));
            const isFree = slot.id === "free";
            return (
              <div
                key={slot.id}
                className={`space-y-3 rounded-xl border bg-[var(--surface)] p-4 ${
                  isFree
                    ? "border-violet-500/40 ring-1 ring-violet-500/20"
                    : "border-[var(--border)]"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">
                      {slot.label}
                      {isFree ? (
                        <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-violet-300">
                          Free path
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-[var(--muted)]">{slot.hint}</p>
                  </div>
                  {currentUrl ? (
                    <span className="max-w-[14rem] truncate text-[11px] text-emerald-300/90">
                      {libraryLabel(library, currentUrl)}
                    </span>
                  ) : (
                    <span className="text-[11px] text-amber-200/90">Unassigned — upload below</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <input
                    ref={(el) => {
                      slotFileRefs.current[slot.id] = el;
                    }}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v"
                    className="hidden"
                    onChange={(e) => void handleSlotUpload(slot.id, e.target.files)}
                  />
                  <button
                    type="button"
                    className="btn-primary px-3 py-1.5 text-xs font-semibold"
                    disabled={busy || uploading}
                    onClick={() => slotFileRefs.current[slot.id]?.click()}
                  >
                    {busy
                      ? "Uploading…"
                      : hasVideo
                        ? "Replace video"
                        : "Upload video"}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost px-3 py-1.5 text-xs font-semibold"
                    disabled={!hasVideo}
                    onClick={() =>
                      setWatchingSlots((prev) => ({
                        ...prev,
                        [slot.id]: !prev[slot.id],
                      }))
                    }
                  >
                    {watching ? "Hide player" : "Watch"}
                  </button>
                  {hasVideo ? (
                    <button
                      type="button"
                      className="btn-ghost px-3 py-1.5 text-xs text-red-300"
                      onClick={() => {
                        assignSlot(slot.id, "");
                        setWatchingSlots((prev) => ({ ...prev, [slot.id]: false }));
                      }}
                    >
                      Clear slot
                    </button>
                  ) : null}
                </div>

                <label className="block text-xs text-[var(--muted)]">
                  <span className="mb-1 block font-medium text-[var(--text)]">
                    Or choose from library
                  </span>
                  <select
                    value={selectValue}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "") {
                        assignSlot(slot.id, "");
                        setWatchingSlots((prev) => ({ ...prev, [slot.id]: false }));
                        return;
                      }
                      if (v === "__custom__") return;
                      const item = library.find((i) => i.id === v);
                      if (item) {
                      const next = setSlotUrl(assignments, slot.id, item.url);
                      setAssignments(next);
                      setWatchingSlots((prev) => ({ ...prev, [slot.id]: true }));
                      void publishIntroSlots(next)
                        .then(() => {
                          setMessage(
                            `${slot.label} set to “${item.title}” and published live.`,
                          );
                          setError(false);
                        })
                        .catch((err: unknown) => {
                          setUploadError(
                            err instanceof Error
                              ? err.message
                              : "Assigned in UI but publish failed — click Save all videos.",
                          );
                        });
                      }
                    }}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)]"
                  >
                    <option value="">— none —</option>
                    {library.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                        {usedUrls.has(item.url) && item.url !== currentUrl
                          ? " (also elsewhere)"
                          : ""}
                      </option>
                    ))}
                    {currentUrl && !library.some((i) => i.url === currentUrl) ? (
                      <option value="__custom__">
                        Current URL (not in library) — re-upload or clear
                      </option>
                    ) : null}
                  </select>
                </label>

                {watching && hasVideo ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-[var(--muted)]">
                      Admin player — press play to review. Members only see this after you{" "}
                      <strong className="text-[var(--text)]">Save all videos</strong>
                      {isFree ? " (after the ~5s gag for guests)" : ""}.
                    </p>
                    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-black">
                      <PlayableVideoFrame
                        key={`slot-${slot.id}:${currentUrl}`}
                        className="aspect-video w-full max-h-[28rem]"
                        videoUrl={currentUrl}
                        title={slot.label}
                        volumeDb={volumeDb}
                        autoplay={false}
                        duckBackgroundMusic
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">3 · Free ticket gag (product-fixed)</h2>
        <p className="text-xs text-[var(--muted)] leading-relaxed">
          <strong className="text-[var(--text)]">Guests</strong> who tap Free always get the in-app{" "}
          chorus clip (~{Math.round(FREE_TICKET_RICKROLL_DURATION_MS / 1000)}s), then your{" "}
          <strong className="text-[var(--text)]">Free Explorer intro</strong> from section 2.{" "}
          <strong className="text-[var(--text)]">Signed-in members</strong> skip the gag. The gag
          itself is not uploadable — product-fixed only.
        </p>
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted)]">
          In-app file only: <code className="text-[var(--text)]">{FREE_TICKET_GAG_SRC}</code>
          {" · "}
          {Math.round(FREE_TICKET_RICKROLL_DURATION_MS / 1000)}s. YouTube is not used here. It
          takes too long to start.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={gagEnabled}
              onChange={(e) => setGagEnabled(e.target.checked)}
            />
            Allow gag for guests (kill switch — leave on)
          </label>
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-xs font-semibold"
            onClick={() => setWatchingGag((v) => !v)}
          >
            {watchingGag ? "Hide gag player" : "Watch gag (admin)"}
          </button>
        </div>
        {watchingGag ? (
          <div className="space-y-2">
            <p className="text-[11px] text-[var(--muted)]">
              Admin preview is the same in-app file guests hear. On the live Free ticket it
              stops after ~{Math.round(FREE_TICKET_RICKROLL_DURATION_MS / 1000)}s and cuts to
              Free Explorer intro.
            </p>
            <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-black">
              <PlayableVideoFrame
                className="aspect-video w-full max-h-[28rem]"
                videoUrl={FREE_TICKET_GAG_SRC}
                title="Free ticket gag"
                autoplay={false}
                duckBackgroundMusic
              />
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">4 · Thank you for the purchase · YouTube</h2>
        <YoutubeVideoField
          label="Post-checkout thank-you"
          hint="YouTube link — payment success screen after Stripe."
          value={purchaseUrl}
          onChange={setPurchaseUrl}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">5 · Member Today strip · YouTube</h2>
        <label className="block text-sm">
          <span className="font-medium">Weekly video title</span>
          <input
            value={weeklyTitle}
            onChange={(e) => setWeeklyTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
          />
        </label>
        <YoutubeVideoField label="Weekly coach video" value={weeklyUrl} onChange={setWeeklyUrl} />
        <label className="block text-sm">
          <span className="font-medium">Dinner video title</span>
          <input
            value={dinnerTitle}
            onChange={(e) => setDinnerTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
          />
        </label>
        <YoutubeVideoField label="Dinner video" value={dinnerUrl} onChange={setDinnerUrl} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">6 · Daily inspirational · YouTube</h2>
          <button type="button" className="btn-ghost text-xs" onClick={addClip}>
            + Add clip
          </button>
        </div>
        <p className="text-xs text-[var(--muted)]">
          YouTube only. Optional day-of-week targeting. Member Today shows today&apos;s match first.
        </p>
        {clips.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-sm text-[var(--muted)]">
            No daily clips yet.
          </p>
        ) : (
          <ul className="space-y-4">
            {clips.map((clip, index) => (
              <li
                key={clip.id}
                className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Clip {index + 1}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-red-300 hover:underline"
                    onClick={() => removeClip(index)}
                  >
                    Remove
                  </button>
                </div>
                <input
                  value={clip.title}
                  onChange={(e) => updateClip(index, { title: e.target.value })}
                  placeholder="Title"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
                />
                <select
                  value={clip.weekday === null ? "" : String(clip.weekday)}
                  onChange={(e) =>
                    updateClip(index, {
                      weekday: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
                >
                  {WEEKDAYS.map((d) => (
                    <option key={d.label} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <YoutubeVideoField
                  label="YouTube URL"
                  value={clip.videoUrl}
                  onChange={(v) => updateClip(index, { videoUrl: v })}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="sticky bottom-3 z-10 flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)]/95 p-3 backdrop-blur sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || uploading}
          className="btn-primary px-5 py-2.5 text-sm font-semibold"
        >
          {saving ? "Saving…" : "Save all videos"}
        </button>
        {message ? (
          <p className={`text-sm ${error ? "text-red-300" : "text-emerald-300"}`}>{message}</p>
        ) : (
          <p className="text-xs text-[var(--muted)]">
            Upload / Replace files join the library immediately. Save publishes slot assignments to
            the live site. Watch is admin-only and does not require Save.
          </p>
        )}
      </div>
    </div>
  );
}
