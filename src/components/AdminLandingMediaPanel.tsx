"use client";

import { useState } from "react";
import { saveLandingMediaAction } from "@/app/admin/landing/actions";
import PlayableVideoFrame from "@/components/PlayableVideoFrame";
import { WELCOME_VIDEO_PLAN_OPTIONS } from "@/lib/landing-media";
import type { WelcomeVideosByPlan } from "@/lib/landing-media-store";
import { isAllowedCoachIntroVideoUrl } from "@/lib/site-video";

export default function AdminLandingMediaPanel({
  initialWelcomeUrl = "",
  initialWelcomeVideosByPlan = {},
  initialFreeUrl = "",
}: {
  initialWelcomeUrl?: string;
  initialWelcomeVideosByPlan?: WelcomeVideosByPlan;
  initialFreeUrl?: string;
}) {
  const [welcomeUrl, setWelcomeUrl] = useState(initialWelcomeUrl);
  const [welcomeByPlan, setWelcomeByPlan] = useState<WelcomeVideosByPlan>(initialWelcomeVideosByPlan);
  const [freeUrl, setFreeUrl] = useState(initialFreeUrl);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setError(false);

    const welcome = welcomeUrl.trim();
    const free = freeUrl.trim();

    if (welcome && !isAllowedCoachIntroVideoUrl(welcome)) {
      setError(true);
      setMessage("Default welcome video must be an uploaded site file (MP4/WebM/MOV).");
      setSaving(false);
      return;
    }
    for (const { plan, label } of WELCOME_VIDEO_PLAN_OPTIONS) {
      const url = welcomeByPlan[plan]?.trim();
      if (url && !isAllowedCoachIntroVideoUrl(url)) {
        setError(true);
        setMessage(`${label} welcome video must be an uploaded site file (MP4/WebM/MOV).`);
        setSaving(false);
        return;
      }
    }
    if (free && !isAllowedCoachIntroVideoUrl(free)) {
      setError(true);
      setMessage("Free-ticket video must be an uploaded site file (MP4/WebM/MOV).");
      setSaving(false);
      return;
    }
    const result = await saveLandingMediaAction({
      welcomeVideoUrl: welcome || null,
      welcomeVideosByPlan: welcomeByPlan,
      freeChastiseVideoUrl: free || null,
      venmoQrUrl: null,
      venmoHandle: null,
      venmoInstructions: null,
    });

    if ("error" in result && result.error) {
      setError(true);
      setMessage(result.error);
    } else if ("ok" in result && result.ok) {
      setWelcomeUrl(result.storedWelcomeVideoUrl || "");
      if (result.storedWelcomeVideosByPlan) setWelcomeByPlan(result.storedWelcomeVideosByPlan);
      setFreeUrl(result.storedFreeChastiseVideoUrl || "");
      setMessage("Saved — live on the site now.");
      setError(false);
    } else {
      setError(true);
      setMessage("Save failed");
    }

    setSaving(false);
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-[#7c3aed]/30 bg-[#7c3aed]/5 p-4 text-sm text-[var(--accent-fg)]">
        <p className="font-semibold text-[var(--text)]">Where these show up</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--muted)]">
          <li>
            <strong className="text-[var(--text)]">Welcome videos</strong> — onboarding step 1 per ticket
            (Free Explorer, Coach Class, Business Class, 1st Class). Falls back to the default clip.
          </li>
          <li>
            <strong className="text-[var(--text)]">Free-ticket video</strong> — Jeremy&apos;s free-tier intro
            after the built-in 5s chorus gag when someone taps{" "}
            <span className="text-[var(--accent-fg)]">Free</span>. Site music
            mutes automatically.
          </li>
        </ul>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Upload coach intros under{" "}
          <a href="/admin/videos" className="text-[var(--accent-fg)] underline">
            Admin → Videos
          </a>{" "}
          — they are stored on this site like the Free ticket clip, not YouTube. Memberships
          collect on Stripe only.
        </p>
      </div>

      <div className="card space-y-4">
        <div>
          <p className="text-sm font-semibold text-[var(--text)]">Welcome videos (onboarding)</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Upload under Admin → Videos (site file only). Members see their plan&apos;s clip on
            setup step 1.
          </p>
        </div>
        {WELCOME_VIDEO_PLAN_OPTIONS.map(({ plan, label }) => {
          const value = welcomeByPlan[plan] || "";
          return (
            <VideoField
              key={plan}
              id={`welcome-${plan}`}
              label={`${label} welcome`}
              hint={`Shown when someone signs up on the ${label} ticket.`}
              value={value}
              previewUrl={value || welcomeUrl}
              onChange={(next) =>
                setWelcomeByPlan((prev) => ({
                  ...prev,
                  [plan]: next.trim() || undefined,
                }))
              }
              where={`Member onboard · ${label}`}
              compact
            />
          );
        })}
        <VideoField
          id="welcome-default"
          label="Default welcome (fallback)"
          hint="Used when a plan-specific URL is blank — also powers Watch intro on the home page."
          value={welcomeUrl}
          onChange={setWelcomeUrl}
          previewUrl={welcomeUrl}
          where="Home · Watch intro · onboard fallback"
          compact
        />
      </div>

      <VideoField
        id="free"
        label="Free-ticket intro (Jeremy)"
        hint="Coach free-tier intro (uploaded site file). App always plays a 5s chorus gag first, then cuts over to this clip. Don’t paste Rickroll here — that’s built-in."
        value={freeUrl}
        onChange={setFreeUrl}
        previewUrl={freeUrl}
        where="Home → Free ticket"
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex h-11 items-center justify-center rounded-full bg-[#7c3aed] px-8 text-sm font-semibold text-[var(--text)] hover:bg-[#6d2dd6] disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save landing media"}
        </button>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[#7c3aed] hover:underline"
        >
          Preview public home page ↗
        </a>
        <a
          href="/member/checkout?plan=member"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[#7c3aed] hover:underline"
        >
          Preview checkout (Coach Class) ↗
        </a>
      </div>

      {message && (
        <p className={`text-sm ${error ? "text-amber-400" : "text-emerald-400"}`}>{message}</p>
      )}
    </div>
  );
}

function VideoField({
  id,
  label,
  hint,
  value,
  onChange,
  previewUrl,
  where,
  compact = false,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  previewUrl?: string;
  where: string;
  compact?: boolean;
}) {
  const previewVideo =
    previewUrl?.trim() && isAllowedCoachIntroVideoUrl(previewUrl) ? previewUrl.trim() : null;
  return (
    <div className={`space-y-3 ${compact ? "rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/40 p-3" : "card"}`}>
      <div>
        <label htmlFor={id} className="text-sm font-semibold text-[var(--text)]">
          {label}
        </label>
        <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>
        <p className="mt-1 text-[10px] uppercase tracking-wider text-[#7c3aed]">{where}</p>
      </div>
      <input
        id={id}
        className="input w-full"
        placeholder="/videos/jeremy-welcome.mp4 or an uploaded site file"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {previewVideo ? (
        <div className="aspect-video overflow-hidden rounded-xl bg-black ring-1 ring-[var(--border)]">
          <PlayableVideoFrame
            className="h-full w-full"
            videoUrl={previewVideo}
            title={`${label} preview`}
          />
        </div>
      ) : (
        <p className="text-xs text-[var(--muted)] italic">
          Upload under Admin → Videos, or paste a URL to preview.
        </p>
      )}
    </div>
  );
}