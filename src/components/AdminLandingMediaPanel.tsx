"use client";

import { useState } from "react";
import { saveLandingVideosAction } from "@/app/admin/landing/actions";
import { landingVideoEmbedSrc } from "@/lib/landing-media";
import { isYoutubeUrl } from "@/lib/youtube";

export default function AdminLandingMediaPanel({
  initialWelcomeUrl = "",
  initialFreeUrl = "",
}: {
  initialWelcomeUrl?: string;
  initialFreeUrl?: string;
}) {
  const [welcomeUrl, setWelcomeUrl] = useState(initialWelcomeUrl);
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

    const result = await saveLandingVideosAction({
      welcomeVideoUrl: welcome || null,
      freeChastiseVideoUrl: free || null,
    });

    if ("error" in result && result.error) {
      setError(true);
      setMessage(result.error);
    } else if ("ok" in result && result.ok) {
      setWelcomeUrl(result.storedWelcomeVideoUrl || "");
      setFreeUrl(result.storedFreeChastiseVideoUrl || "");
      setMessage("Saved — live on the public landing page now.");
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
            <strong className="text-white">Welcome video</strong> — public home page,{" "}
            <span className="text-[#c4b5fd]">Enter the site</span> button (hover on desktop, tap on
            phone). Also logged-in “Welcome — watch intro”.
          </li>
          <li>
            <strong className="text-white">Free-ticket video</strong> — when someone taps the{" "}
            <span className="text-[#c4b5fd]">Free</span> ticket on the landing page.
          </li>
        </ul>
        <p className="mt-3 text-xs text-[#9d8ab8]">
          Upload your clip to YouTube (public or unlisted), paste the link here, and save. You can
          change either video anytime.
        </p>
      </div>

      <VideoField
        id="welcome"
        label="Welcome video"
        hint="Short intro — who you are, what The Train Station is."
        value={welcomeUrl}
        onChange={setWelcomeUrl}
        previewSrc={welcomePreview}
        where="Home → Enter the site"
      />

      <VideoField
        id="free"
        label="Free-ticket video"
        hint="Playful “you clicked FREE?” message before they continue to free signup."
        value={freeUrl}
        onChange={setFreeUrl}
        previewSrc={freePreview}
        where="Home → Free ticket"
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex h-11 items-center justify-center rounded-full bg-[#7c3aed] px-8 text-sm font-semibold text-white hover:bg-[#6d2dd6] disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save landing videos"}
        </button>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[#7c3aed] hover:underline"
        >
          Preview public home page ↗
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