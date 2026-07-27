"use client";

import { useState } from "react";
import {
  saveLandingMediaAction,
  saveMemberContentAction,
} from "@/app/admin/landing/actions";
import YoutubeAutoplayFrame from "@/components/YoutubeAutoplayFrame";
import {
  FREE_TICKET_RICKROLL_URL,
  WELCOME_VIDEO_PLAN_OPTIONS,
} from "@/lib/landing-media";
import type { WelcomeVideosByPlan } from "@/lib/landing-media-store";
import type {
  DailyInspirationClip,
  NutritionCalorieTier,
} from "@/lib/member-content-store";
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

function VideoField({
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

export default function AdminSiteVideosPanel({
  initialWelcomeUrl = "",
  initialWelcomeVideosByPlan = {},
  initialFreeUrl = "",
  initialGagUrl = "",
  initialGagStartSec = 43,
  initialGagDurationSec = 10,
  initialGagEnabled = true,
  initialPurchaseThankYouUrl = "",
  initialWeeklyUrl = "",
  initialWeeklyTitle = "",
  initialDinnerUrl = "",
  initialDinnerTitle = "",
  initialDailyClips = [],
  initialNutritionIntro = "",
  initialNutritionTiers = [],
}: {
  initialWelcomeUrl?: string;
  initialWelcomeVideosByPlan?: WelcomeVideosByPlan;
  initialFreeUrl?: string;
  initialGagUrl?: string;
  initialGagStartSec?: number;
  initialGagDurationSec?: number;
  initialGagEnabled?: boolean;
  initialPurchaseThankYouUrl?: string;
  initialWeeklyUrl?: string;
  initialWeeklyTitle?: string;
  initialDinnerUrl?: string;
  initialDinnerTitle?: string;
  initialDailyClips?: DailyInspirationClip[];
  initialNutritionIntro?: string;
  initialNutritionTiers?: NutritionCalorieTier[];
}) {
  const [welcomeUrl, setWelcomeUrl] = useState(initialWelcomeUrl);
  const [welcomeByPlan, setWelcomeByPlan] = useState<WelcomeVideosByPlan>(
    initialWelcomeVideosByPlan,
  );
  const [freeUrl, setFreeUrl] = useState(initialFreeUrl);
  const [gagUrl, setGagUrl] = useState(initialGagUrl);
  const [gagStartSec, setGagStartSec] = useState(String(initialGagStartSec));
  const [gagDurationSec, setGagDurationSec] = useState(String(initialGagDurationSec));
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

    if (!yt(welcomeUrl, "Default welcome video")) {
      setSaving(false);
      return;
    }
    for (const { plan, label } of WELCOME_VIDEO_PLAN_OPTIONS) {
      const url = welcomeByPlan[plan]?.trim() || "";
      if (url && !isYoutubeUrl(url)) {
        setError(true);
        setMessage(`${label} welcome video must be a YouTube link.`);
        setSaving(false);
        return;
      }
    }
    if (!yt(freeUrl, "Free-ticket intro")) {
      setSaving(false);
      return;
    }
    if (!yt(gagUrl, "Gag / rickroll video")) {
      setSaving(false);
      return;
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

    const start = Number(gagStartSec);
    const dur = Number(gagDurationSec);

    const landingResult = await saveLandingMediaAction({
      welcomeVideoUrl: welcomeUrl.trim() || null,
      welcomeVideosByPlan: welcomeByPlan,
      freeChastiseVideoUrl: freeUrl.trim() || null,
      gagVideoUrl: gagUrl.trim() || null,
      gagStartSec: Number.isFinite(start) ? start : 43,
      gagDurationSec: Number.isFinite(dur) ? dur : 10,
      gagEnabled,
      purchaseThankYouVideoUrl: purchaseUrl.trim() || null,
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
      setWelcomeUrl(landingResult.storedWelcomeVideoUrl || "");
      if (landingResult.storedWelcomeVideosByPlan) {
        setWelcomeByPlan(landingResult.storedWelcomeVideosByPlan);
      }
      setFreeUrl(landingResult.storedFreeChastiseVideoUrl || "");
      setGagUrl(landingResult.storedGagVideoUrl || "");
      setGagStartSec(String(landingResult.storedGagStartSec ?? 43));
      setGagDurationSec(String(landingResult.storedGagDurationSec ?? 10));
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

    setMessage("Saved — all videos live on the site now.");
    setError(false);
    setSaving(false);
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4 text-sm text-[var(--muted)]">
        <p className="font-semibold text-violet-100">Site video desk</p>
        <p className="mt-1">
          One place for every coach-facing YouTube: free-ticket gag, intros, purchase thank-you,
          weekly / dinner / daily inspiration. Paste full YouTube links (Share → Copy link).
        </p>
        <p className="mt-2 text-xs">
          Exercise library demos stay under{" "}
          <a href="/admin/exercises" className="text-accent hover:underline">
            Exercises
          </a>
          . Venmo QR stays under{" "}
          <a href="/admin/landing" className="text-accent hover:underline">
            Landing
          </a>
          .
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">1 · Free ticket gag (~10s)</h2>
        <p className="text-xs text-[var(--muted)]">
          Default is Rick Astley from the chorus. Plays when someone taps Free, then crossfades to
          Jeremy&apos;s free-ticket intro.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={gagEnabled}
            onChange={(e) => setGagEnabled(e.target.checked)}
          />
          Play gag before free-ticket intro
        </label>
        <VideoField
          label="Gag video URL"
          hint={`Leave blank for default: ${FREE_TICKET_RICKROLL_URL}`}
          value={gagUrl}
          onChange={setGagUrl}
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="font-medium">Start at (seconds)</span>
            <input
              type="number"
              min={0}
              max={3600}
              value={gagStartSec}
              onChange={(e) => setGagStartSec(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">Play for (seconds)</span>
            <input
              type="number"
              min={3}
              max={60}
              value={gagDurationSec}
              onChange={(e) => setGagDurationSec(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
            />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">2 · Intro / welcome videos</h2>
        <VideoField
          label="Default welcome / intro"
          hint="Onboarding step 1 + landing when no plan-specific clip."
          value={welcomeUrl}
          onChange={setWelcomeUrl}
        />
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Per ticket (optional)
          </p>
          {WELCOME_VIDEO_PLAN_OPTIONS.map(({ plan, label }) => (
            <VideoField
              key={plan}
              label={label}
              value={welcomeByPlan[plan] || ""}
              onChange={(v) => setWelcomeByPlan((prev) => ({ ...prev, [plan]: v || null }))}
            />
          ))}
        </div>
        <VideoField
          label="Free-ticket intro (Jeremy)"
          hint="After the gag when someone taps Free / Explorer."
          value={freeUrl}
          onChange={setFreeUrl}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">3 · Thank you for the purchase</h2>
        <VideoField
          label="Post-checkout thank-you"
          hint="Shown on the payment success screen after Stripe (and can be reused later)."
          value={purchaseUrl}
          onChange={setPurchaseUrl}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">4 · Member Today strip</h2>
        <label className="block text-sm">
          <span className="font-medium">Weekly video title</span>
          <input
            value={weeklyTitle}
            onChange={(e) => setWeeklyTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
          />
        </label>
        <VideoField label="Weekly coach video" value={weeklyUrl} onChange={setWeeklyUrl} />
        <label className="block text-sm">
          <span className="font-medium">Dinner video title</span>
          <input
            value={dinnerTitle}
            onChange={(e) => setDinnerTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
          />
        </label>
        <VideoField label="Dinner video" value={dinnerUrl} onChange={setDinnerUrl} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">5 · Daily inspirational videos</h2>
          <button type="button" className="btn-ghost text-xs" onClick={addClip}>
            + Add clip
          </button>
        </div>
        <p className="text-xs text-[var(--muted)]">
          Optional day-of-week targeting (Sunday–Saturday). Leave “Any day” for a general library
          clip. Member Today shows today&apos;s match first.
        </p>
        {clips.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-sm text-[var(--muted)]">
            No daily clips yet — add one when Jeremy has an inspiration video ready.
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
                <VideoField
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
          disabled={saving}
          className="btn-primary px-5 py-2.5 text-sm font-semibold"
        >
          {saving ? "Saving…" : "Save all videos"}
        </button>
        {message ? (
          <p className={`text-sm ${error ? "text-red-300" : "text-emerald-300"}`}>{message}</p>
        ) : (
          <p className="text-xs text-[var(--muted)]">Saves public + member video config immediately.</p>
        )}
      </div>
    </div>
  );
}
