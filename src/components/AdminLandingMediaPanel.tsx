"use client";

import { useEffect, useState } from "react";
import { landingVideoEmbedSrc } from "@/lib/landing-media";
import { isYoutubeUrl } from "@/lib/youtube";

type LandingMediaState = {
  welcomeVideoUrl: string | null;
  freeChastiseVideoUrl: string | null;
  storedWelcomeVideoUrl: string | null;
  storedFreeChastiseVideoUrl: string | null;
  updatedAt: string;
  hasWelcome: boolean;
  hasFreeChastise: boolean;
};

export default function AdminLandingMediaPanel() {
  const [welcomeUrl, setWelcomeUrl] = useState("");
  const [freeUrl, setFreeUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/landing-media");
      const data = (await res.json()) as LandingMediaState & { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not load landing videos.");
      setWelcomeUrl(data.storedWelcomeVideoUrl || "");
      setFreeUrl(data.storedFreeChastiseVideoUrl || "");
    } catch (e: unknown) {
      setError(true);
      setMessage(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

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

    try {
      const res = await fetch("/api/admin/landing-media", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          welcomeVideoUrl: welcome || null,
          freeChastiseVideoUrl: free || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setWelcomeUrl(data.storedWelcomeVideoUrl || "");
      setFreeUrl(data.storedFreeChastiseVideoUrl || "");
      setMessage("Saved — live on the public landing page now.");
      setError(false);
    } catch (e: unknown) {
      setError(true);
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const welcomePreview = landingVideoEmbedSrc(welcomeUrl || null);
  const freePreview = landingVideoEmbedSrc(freeUrl || null);

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Loading landing videos…</p>;
  }

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
          Upload your clip to YouTube (public or unlisted), then paste the link here. You can swap
          either video anytime — no redeploy needed.
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