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
  initialVenmoQrUrl = "",
  initialVenmoHandle = "",
  initialVenmoInstructions = "",
}: {
  initialWelcomeUrl?: string;
  initialWelcomeVideosByPlan?: WelcomeVideosByPlan;
  initialFreeUrl?: string;
  initialVenmoQrUrl?: string;
  initialVenmoHandle?: string;
  initialVenmoInstructions?: string;
}) {
  const [welcomeUrl, setWelcomeUrl] = useState(initialWelcomeUrl);
  const [welcomeByPlan, setWelcomeByPlan] = useState<WelcomeVideosByPlan>(initialWelcomeVideosByPlan);
  const [freeUrl, setFreeUrl] = useState(initialFreeUrl);
  const [venmoQrUrl, setVenmoQrUrl] = useState(initialVenmoQrUrl);
  const [venmoHandle, setVenmoHandle] = useState(initialVenmoHandle);
  const [venmoInstructions, setVenmoInstructions] = useState(initialVenmoInstructions);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setError(false);

    const welcome = welcomeUrl.trim();
    const free = freeUrl.trim();
    const qr = venmoQrUrl.trim();

    if (welcome && !isAllowedCoachIntroVideoUrl(welcome)) {
      setError(true);
      setMessage("Default welcome video must be an uploaded file or YouTube link.");
      setSaving(false);
      return;
    }
    for (const { plan, label } of WELCOME_VIDEO_PLAN_OPTIONS) {
      const url = welcomeByPlan[plan]?.trim();
      if (url && !isAllowedCoachIntroVideoUrl(url)) {
        setError(true);
        setMessage(`${label} welcome video must be an uploaded file or YouTube link.`);
        setSaving(false);
        return;
      }
    }
    if (free && !isAllowedCoachIntroVideoUrl(free)) {
      setError(true);
      setMessage("Free-ticket video must be an uploaded file or YouTube link.");
      setSaving(false);
      return;
    }
    if (qr) {
      try {
        const parsed = new URL(qr);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          throw new Error("invalid");
        }
      } catch {
        setError(true);
        setMessage("Venmo QR must be a full image URL (https://…).");
        setSaving(false);
        return;
      }
    }

    const result = await saveLandingMediaAction({
      welcomeVideoUrl: welcome || null,
      welcomeVideosByPlan: welcomeByPlan,
      freeChastiseVideoUrl: free || null,
      venmoQrUrl: qr || null,
      venmoHandle: venmoHandle.trim() || null,
      venmoInstructions: venmoInstructions.trim() || null,
    });

    if ("error" in result && result.error) {
      setError(true);
      setMessage(result.error);
    } else if ("ok" in result && result.ok) {
      setWelcomeUrl(result.storedWelcomeVideoUrl || "");
      if (result.storedWelcomeVideosByPlan) setWelcomeByPlan(result.storedWelcomeVideosByPlan);
      setFreeUrl(result.storedFreeChastiseVideoUrl || "");
      setVenmoQrUrl(result.storedVenmoQrUrl || "");
      setVenmoHandle(result.storedVenmoHandle || "");
      setVenmoInstructions(result.storedVenmoInstructions || "");
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
      <div className="rounded-2xl border border-[#7c3aed]/30 bg-[#7c3aed]/5 p-4 text-sm text-[#c4b5fd]">
        <p className="font-semibold text-white">Where these show up</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[#9d8ab8]">
          <li>
            <strong className="text-white">Welcome videos</strong> — onboarding step 1 per ticket
            (Free Explorer, Coach Class, Business Class, 1st Class). Falls back to the default clip.
          </li>
          <li>
            <strong className="text-white">Free-ticket video</strong> — Jeremy&apos;s free-tier intro
            after the built-in 5s chorus gag when someone taps{" "}
            <span className="text-[#c4b5fd]">Free</span>. Site music
            mutes automatically.
          </li>
          <li>
            <strong className="text-white">Venmo QR</strong> — member checkout backup when Stripe is
            still Test or the member prefers Venmo. Funds go to the{" "}
            <strong className="text-white">same business bank account</strong> as Stripe payouts
            (Jeremy’s Train Station business). After they pay,{" "}
            <strong className="text-white">Admin → Members → Mark paid (Venmo)</strong>.
          </li>
        </ul>
        <p className="mt-3 text-xs text-[#9d8ab8]">
          Prefer uploading coach intros under{" "}
          <a href="/admin/videos" className="text-[#c4b5fd] underline">
            Admin → Videos
          </a>{" "}
          (stored on site). You can still paste a YouTube URL here. Venmo QR can be{" "}
          <code className="text-[10px] text-[#c4b5fd]">
            https://www.thetrainstation.co/images/venmo-jeremy-qr.png
          </code>{" "}
          or any https image URL of your QR.
        </p>
      </div>

      <div className="card space-y-4">
        <div>
          <p className="text-sm font-semibold text-white">Welcome videos (onboarding)</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Upload (recommended) under Admin → Videos, or paste a YouTube / stored URL here. Members
            see their plan&apos;s clip on setup step 1.
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
        hint="Coach free-tier intro (uploaded file or YouTube). App always plays a 5s chorus gag first, then cuts over to this clip (falls back to Welcome if empty). Don’t paste Rickroll here — that’s built-in."
        value={freeUrl}
        onChange={setFreeUrl}
        previewUrl={freeUrl}
        where="Home → Free ticket"
      />

      <div className="card space-y-3">
        <div>
          <label htmlFor="venmo-qr" className="text-sm font-semibold text-white">
            Venmo QR image
          </label>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Paste a direct link to your Venmo QR image. Members see this on checkout if Stripe is
            slow or they prefer Venmo.
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-[#7c3aed]">
            Member checkout → Pay with Venmo
          </p>
        </div>
        <input
          id="venmo-qr"
          className="input w-full"
          placeholder="https://…/venmo-qr.png"
          value={venmoQrUrl}
          onChange={(e) => setVenmoQrUrl(e.target.value)}
        />
        {venmoQrUrl.trim() ? (
          <div className="mx-auto max-w-[220px] overflow-hidden rounded-xl bg-white p-3 ring-1 ring-[#3d2660]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={venmoQrUrl.trim()}
              alt="Venmo QR preview"
              className="h-auto w-full"
            />
          </div>
        ) : (
          <p className="text-xs text-[var(--muted)] italic">Paste an image URL to preview.</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="venmo-handle" className="text-xs font-medium text-[var(--muted)]">
              Venmo handle (optional)
            </label>
            <input
              id="venmo-handle"
              className="input mt-1 w-full"
              placeholder="@Jeremy-…"
              value={venmoHandle}
              onChange={(e) => setVenmoHandle(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="venmo-instructions" className="text-xs font-medium text-[var(--muted)]">
              Instructions (optional)
            </label>
            <textarea
              id="venmo-instructions"
              className="input mt-1 min-h-[72px] w-full"
              placeholder="Include your name in the note. Jeremy will confirm within 24 hours."
              value={venmoInstructions}
              onChange={(e) => setVenmoInstructions(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex h-11 items-center justify-center rounded-full bg-[#7c3aed] px-8 text-sm font-semibold text-white hover:bg-[#6d2dd6] disabled:opacity-60"
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
        <label htmlFor={id} className="text-sm font-semibold text-white">
          {label}
        </label>
        <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>
        <p className="mt-1 text-[10px] uppercase tracking-wider text-[#7c3aed]">{where}</p>
      </div>
      <input
        id={id}
        className="input w-full"
        placeholder="Uploaded URL or https://www.youtube.com/watch?v=…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {previewVideo ? (
        <div className="aspect-video overflow-hidden rounded-xl bg-black ring-1 ring-[#3d2660]">
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