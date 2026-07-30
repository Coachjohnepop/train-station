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
import { FREE_TICKET_RICKROLL_URL } from "@/lib/landing-media";
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

/** YouTube-only field (gag, weekly, dinner, daily). */
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
  return (
    <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <label className="block text-sm font-semibold text-[var(--text)]">{label}</label>
      {hint ? <p className="text-xs text-[var(--muted)]">{hint}</p> : null}
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "https://www.youtube.com/watch?v=… or youtu.be/…"}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
      />
      {preview ? (
        <div className="overflow-hidden rounded-lg border border-[var(--border)]">
          <YoutubeAutoplayFrame
            className="aspect-video w-full"
            videoUrl={preview}
            title={label}
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
  initialGagDurationSec = 10,
  initialGagEnabled = true,
  initialPurchaseThankYouUrl = "",
  initialEquipmentIntroUrl = "",
  initialWeeklyUrl = "",
  initialWeeklyTitle = "",
  initialDinnerUrl = "",
  initialDinnerTitle = "",
  initialDailyClips = [],
  initialNutritionIntro = "",
  initialNutritionTiers = [],
  initialLibrary = [],
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
  initialWeeklyUrl?: string;
  initialWeeklyTitle?: string;
  initialDinnerUrl?: string;
  initialDinnerTitle?: string;
  initialDailyClips?: DailyInspirationClip[];
  initialNutritionIntro?: string;
  initialNutritionTiers?: NutritionCalorieTier[];
  initialLibrary?: SiteVideoLibraryItem[];
}) {
  const [library, setLibrary] = useState<SiteVideoLibraryItem[]>(initialLibrary);
  const [assignments, setAssignments] = useState<CoachIntroAssignments>(() =>
    assignmentsFromLanding({
      welcomeVideoUrl: initialWelcomeUrl,
      freeChastiseVideoUrl: initialFreeUrl,
      equipmentIntroVideoUrl: initialEquipmentIntroUrl,
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
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const usedUrls = useMemo(() => {
    const set = new Set<string>();
    const overall = assignments.overall.trim();
    const free = assignments.free.trim();
    const equipment = assignments.equipment.trim();
    if (overall) set.add(overall);
    if (free) set.add(free);
    if (equipment) set.add(equipment);
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

  async function uploadOneFile(file: File, index: number, total: number) {
    if (file.size > SITE_VIDEO_MAX_BYTES) {
      throw new Error(`${file.name}: too large (max ${MAX_MB} MB).`);
    }
    setUploadProgress(`Uploading ${index + 1} of ${total}: ${file.name}`);
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
          setUploadProgress(
            `Uploading ${index + 1} of ${total}: ${file.name} (${Math.round(p.percentage)}%)`,
          );
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

    await registerInLibrary({
      url,
      title: titleFromFileName(file.name),
      fileName: file.name,
    });
  }

  async function handleMultiUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setUploadError(null);
    setUploadProgress(null);
    const list = Array.from(files);
    try {
      for (let i = 0; i < list.length; i++) {
        await uploadOneFile(list[i], i, list.length);
      }
      setUploadProgress(`Added ${list.length} video${list.length === 1 ? "" : "s"} to library.`);
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
      setUploadProgress(null);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
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
        setMessage(`${label} must be a library video or YouTube link.`);
        return false;
      }
      return true;
    };

    if (!introOk(assignments.overall, "Overall intro")) {
      setSaving(false);
      return;
    }
    if (!introOk(assignments.free, "Free-ticket intro")) {
      setSaving(false);
      return;
    }
    if (!introOk(assignments.equipment, "Gear / equipment intro")) {
      setSaving(false);
      return;
    }
    for (const slot of COACH_INTRO_SLOTS) {
      if (slot.id === "overall" || slot.id === "free" || slot.id === "equipment") continue;
      const url = urlForSlot(slot.id, assignments);
      if (url && !isAllowedCoachIntroVideoUrl(url)) {
        setError(true);
        setMessage(`${slot.label} must be a library video or YouTube link.`);
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

    const landingResult = await saveLandingMediaAction({
      welcomeVideoUrl: assignments.overall.trim() || null,
      welcomeVideosByPlan: assignments.byPlan,
      freeChastiseVideoUrl: assignments.free.trim() || null,
      // Product Free path: fixed 10s Rickroll (never persist custom Shorts / long gag).
      gagVideoUrl: null,
      gagStartSec: 43,
      gagDurationSec: 10,
      gagEnabled,
      purchaseThankYouVideoUrl: purchaseUrl.trim() || null,
      equipmentIntroVideoUrl: assignments.equipment.trim() || null,
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
          welcomeVideosByPlan: landingResult.storedWelcomeVideosByPlan,
        }),
      );
      setGagEnabled(landingResult.storedGagEnabled !== false);
      setPurchaseUrl(landingResult.storedPurchaseThankYouVideoUrl || "");
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
          <strong className="text-[var(--text)]">1)</strong> Upload Jeremy&apos;s clips into the
          library. <strong className="text-[var(--text)]">2)</strong> Assign each one — overall
          intro, Coach Class, Business Class, free-ticket, etc. Everything else (gag, weekly,
          dinner, daily) stays YouTube.
        </p>
      </div>

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
            intro, free-ticket clip, etc. — then assign them in section 2.
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
                        className="btn-ghost text-xs"
                        onClick={() => setPreviewId(open ? null : item.id)}
                      >
                        {open ? "Hide" : "Preview"}
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
                    <div className="mt-3 overflow-hidden rounded-lg border border-[var(--border)] bg-black">
                      <PlayableVideoFrame
                        className="aspect-video w-full"
                        videoUrl={item.url}
                        title={item.title}
                      />
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
          Choose a library video for overall intro, Gear (equipment first visit), each ticket class,
          and the free-ticket intro.
          One video can be used in multiple slots.
        </p>
        <div className="space-y-3">
          {COACH_INTRO_SLOTS.map((slot) => {
            const currentUrl = urlForSlot(slot.id, assignments);
            const selectValue =
              library.find((i) => i.url === currentUrl)?.id ||
              (currentUrl ? "__custom__" : "");
            return (
              <div
                key={slot.id}
                className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">{slot.label}</p>
                    <p className="text-xs text-[var(--muted)]">{slot.hint}</p>
                  </div>
                  {currentUrl ? (
                    <span className="max-w-[14rem] truncate text-[11px] text-emerald-300/90">
                      {libraryLabel(library, currentUrl)}
                    </span>
                  ) : (
                    <span className="text-[11px] text-[var(--muted)]">Unassigned</span>
                  )}
                </div>
                <select
                  value={selectValue}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") {
                      assignSlot(slot.id, "");
                      return;
                    }
                    if (v === "__custom__") return;
                    const item = library.find((i) => i.id === v);
                    if (item) assignSlot(slot.id, item.url);
                  }}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
                >
                  <option value="">— none —</option>
                  {library.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                      {usedUrls.has(item.url) && item.url !== currentUrl ? " (also elsewhere)" : ""}
                    </option>
                  ))}
                  {currentUrl && !library.some((i) => i.url === currentUrl) ? (
                    <option value="__custom__">
                      Current URL (not in library) — re-upload or clear
                    </option>
                  ) : null}
                </select>
                {currentUrl && isAllowedCoachIntroVideoUrl(currentUrl) ? (
                  <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-black">
                    <PlayableVideoFrame
                      className="aspect-video w-full max-h-48"
                      videoUrl={currentUrl}
                      title={slot.label}
                    />
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
          <strong className="text-[var(--text)]">Guests</strong> who tap Free always get the classic{" "}
          ~10s Rick Astley chorus, then your free-ticket intro from the library above.{" "}
          <strong className="text-[var(--text)]">Signed-in members</strong> skip the gag and go
          straight to that intro. Custom gag URLs (Shorts, long clips) are no longer used — they broke
          Free for kids.
        </p>
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted)]">
          Default gag: <code className="text-[var(--text)]">{FREE_TICKET_RICKROLL_URL}</code> · start{" "}
          43s · play 10s
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={gagEnabled}
            onChange={(e) => setGagEnabled(e.target.checked)}
          />
          Allow gag for guests (kill switch — leave on)
        </label>
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
            Uploads join the library immediately. Save publishes slot assignments to the live site.
          </p>
        )}
      </div>
    </div>
  );
}
