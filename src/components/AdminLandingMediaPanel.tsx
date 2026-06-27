"use client";

import { useState } from "react";
import { saveLandingMediaAction } from "@/app/admin/landing/actions";
import { landingVideoEmbedSrc } from "@/lib/landing-media";
import { isYoutubeUrl } from "@/lib/youtube";

export default function AdminLandingMediaPanel({
  initialWelcomeUrl = "",
  initialFreeUrl = "",
  initialVenmoQrUrl = "",
  initialVenmoHandle = "",
  initialVenmoInstructions = "",
}: {
  initialWelcomeUrl?: string;
  initialFreeUrl?: string;
  initialVenmoQrUrl?: string;
  initialVenmoHandle?: string;
  initialVenmoInstructions?: string;
}) {
  const [welcomeUrl, setWelcomeUrl] = useState(initialWelcomeUrl);
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

    if (welcome && !isYoutubeUrl(welcome)) {
      setError(true);
      setMessage("Welcome video must be a YouTube link (youtube.com or youtu.be).");
      setSaving(false);
      return;
    }
    if (free && !isYoutubeUrl(free)) {
      setError(true);
      setMessage("Free-ticket video must be a YouTube link (youtube.com or youtu.be).");
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

  const welcomePreview = landingVideoEmbedSrc(welcomeUrl || null);
  const freePreview = landingVideoEmbedSrc(freeUrl || null);

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-[#7c3aed]/30 bg-[#7c3aed]/5 p-4 text-sm text-[#c4b5fd]">
        <p className="font-semibold text-white">Where these show up</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[#9d8ab8]">
          <li>
            <strong className="text-white">Welcome video</strong> — logged-in home{" "}
            <span className="text-[#c4b5fd]">Watch intro</span> and member onboarding.
          </li>
          <li>
            <strong className="text-white">Free-ticket video</strong> — plays first when someone taps{" "}
            <span className="text-[#c4b5fd]">Free</span> (10s, then fades to Welcome video). Site music
            mutes automatically.
          </li>
          <li>
            <strong className="text-white">Venmo QR</strong> — member checkout page as an alternative
            to Stripe. After they pay, mark them paid in Admin → Members.
          </li>
        </ul>
        <p className="mt-3 text-xs text-[#9d8ab8]">
          Upload clips to YouTube (public or unlisted). For Venmo, screenshot your QR, upload to
          Imgur or your site, paste the image URL here.
        </p>
      </div>

      <VideoField
        id="welcome"
        label="Welcome video"
        hint="Short intro — who you are, what The Train Station is."
        value={welcomeUrl}
        onChange={setWelcomeUrl}
        previewSrc={welcomePreview}
        where="Signed-in home → Watch intro · member onboarding"
      />

      <VideoField
        id="free"
        label="Free-ticket video"
        hint="Prank clip (e.g. Rick Roll) — plays 10 seconds, then crossfades to Welcome video."
        value={freeUrl}
        onChange={setFreeUrl}
        previewSrc={freePreview}
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
  previewSrc,
  where,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  previewSrc: string | null;
  where: string;
}) {
  return (
    <div className="card space-y-3">
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
        placeholder="https://www.youtube.com/watch?v=… or https://youtu.be/…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {previewSrc ? (
        <div className="aspect-video overflow-hidden rounded-xl bg-black ring-1 ring-[#3d2660]">
          <iframe
            className="h-full w-full"
            src={previewSrc}
            title={`${label} preview`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <p className="text-xs text-[var(--muted)] italic">Paste a YouTube URL to preview.</p>
      )}
    </div>
  );
}