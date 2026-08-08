"use client";

import { useState } from "react";
import { saveMemberContentAction } from "@/app/admin/landing/actions";
import YoutubeAutoplayFrame from "@/components/YoutubeAutoplayFrame";
import type { NutritionCalorieTier } from "@/lib/member-content-store";
import { isYoutubeUrl } from "@/lib/youtube";

export default function AdminMemberContentPanel({
  initialWeeklyUrl = "",
  initialWeeklyTitle = "",
  initialDinnerUrl = "",
  initialDinnerTitle = "",
  initialNutritionIntro = "",
  initialNutritionTiers = [],
}: {
  initialWeeklyUrl?: string;
  initialWeeklyTitle?: string;
  initialDinnerUrl?: string;
  initialDinnerTitle?: string;
  initialNutritionIntro?: string;
  initialNutritionTiers?: NutritionCalorieTier[];
}) {
  const [weeklyUrl, setWeeklyUrl] = useState(initialWeeklyUrl);
  const [weeklyTitle, setWeeklyTitle] = useState(initialWeeklyTitle);
  const [dinnerUrl, setDinnerUrl] = useState(initialDinnerUrl);
  const [dinnerTitle, setDinnerTitle] = useState(initialDinnerTitle);
  const [nutritionIntro, setNutritionIntro] = useState(initialNutritionIntro);
  const [tiers, setTiers] = useState<NutritionCalorieTier[]>(initialNutritionTiers);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  function updateTier(index: number, patch: Partial<NutritionCalorieTier>) {
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setError(false);

    if (weeklyUrl.trim() && !isYoutubeUrl(weeklyUrl)) {
      setError(true);
      setMessage("Weekly video must be a YouTube link.");
      setSaving(false);
      return;
    }
    if (dinnerUrl.trim() && !isYoutubeUrl(dinnerUrl)) {
      setError(true);
      setMessage("Dinner video must be a YouTube link.");
      setSaving(false);
      return;
    }

    const result = await saveMemberContentAction({
      weeklyVideoUrl: weeklyUrl.trim() || null,
      weeklyVideoTitle: weeklyTitle.trim(),
      dinnerVideoUrl: dinnerUrl.trim() || null,
      dinnerVideoTitle: dinnerTitle.trim(),
      nutritionIntro: nutritionIntro.trim(),
      nutritionTiers: tiers,
    });

    if ("error" in result && result.error) {
      setError(true);
      setMessage(result.error);
    } else if ("ok" in result && result.ok) {
      setWeeklyUrl(result.storedWeeklyVideoUrl || "");
      setWeeklyTitle(result.storedWeeklyVideoTitle || "");
      setDinnerUrl(result.storedDinnerVideoUrl || "");
      setDinnerTitle(result.storedDinnerVideoTitle || "");
      setNutritionIntro(result.storedNutritionIntro || "");
      setTiers(result.storedNutritionTiers || tiers);
      setMessage("Saved — live on member Today now.");
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
        <p className="font-semibold text-[var(--text)]">Member page content</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--muted)]">
          <li>
            <strong className="text-[var(--text)]">Weekly video</strong> — top of{" "}
            <span className="text-[var(--accent-fg)]">/member/today</span>, hover to play
          </li>
          <li>
            <strong className="text-[var(--text)]">What&apos;s for dinner</strong> — second card on Today
          </li>
          <li>
            <strong className="text-[var(--text)]">Nutrition</strong> — link to sample calorie-day templates
            on <span className="text-[var(--accent-fg)]">/member/nutrition</span>
          </li>
        </ul>
      </div>

      <VideoField
        id="weekly-video"
        label="Weekly coach video"
        hint="Paste a YouTube link — members hover the card on Today to watch."
        titleValue={weeklyTitle}
        onTitleChange={setWeeklyTitle}
        urlValue={weeklyUrl}
        onUrlChange={setWeeklyUrl}
        where="Member Today · top"
      />

      <VideoField
        id="dinner-video"
        label="What's for dinner video"
        hint="Optional meal ideas clip — same hover-to-play pattern."
        titleValue={dinnerTitle}
        onTitleChange={setDinnerTitle}
        urlValue={dinnerUrl}
        onUrlChange={setDinnerUrl}
        where="Member Today"
      />

      <div className="card space-y-4">
        <div>
          <p className="text-sm font-semibold text-[var(--text)]">Nutritional guidance</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Intro text and sample daily diets by calorie level. Members tap a tier to expand.
          </p>
        </div>
        <textarea
          className="input min-h-[80px] w-full"
          value={nutritionIntro}
          onChange={(e) => setNutritionIntro(e.target.value)}
          placeholder="Short intro for the nutrition page…"
        />
        <div className="space-y-4">
          {tiers.map((tier, index) => (
            <div
              key={tier.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/40 p-3 space-y-2"
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-[var(--muted)]">Calories</label>
                  <input
                    type="number"
                    className="input mt-1 w-full"
                    value={tier.calories}
                    onChange={(e) =>
                      updateTier(index, { calories: Number(e.target.value) || tier.calories })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Label</label>
                  <input
                    className="input mt-1 w-full"
                    value={tier.label}
                    onChange={(e) => updateTier(index, { label: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-[var(--muted)]">Sample day (meals / notes)</label>
                <textarea
                  className="input mt-1 min-h-[72px] w-full"
                  value={tier.sampleDay}
                  onChange={(e) => updateTier(index, { sampleDay: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex h-11 items-center justify-center rounded-full bg-[#7c3aed] px-8 text-sm font-semibold text-[var(--text)] hover:bg-[#6d2dd6] disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save member content"}
        </button>
        <a
          href="/member/today"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[#7c3aed] hover:underline"
        >
          Preview member Today ↗
        </a>
        <a
          href="/member/nutrition"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[#7c3aed] hover:underline"
        >
          Preview nutrition page ↗
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
  titleValue,
  onTitleChange,
  urlValue,
  onUrlChange,
  where,
}: {
  id: string;
  label: string;
  hint: string;
  titleValue: string;
  onTitleChange: (v: string) => void;
  urlValue: string;
  onUrlChange: (v: string) => void;
  where: string;
}) {
  const previewVideo = urlValue.trim() && isYoutubeUrl(urlValue) ? urlValue.trim() : null;
  return (
    <div className="card space-y-3">
      <div>
        <label htmlFor={`${id}-label`} className="text-sm font-semibold text-[var(--text)]">
          {label}
        </label>
        <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>
        <p className="mt-1 text-[10px] uppercase tracking-wider text-[#7c3aed]">{where}</p>
      </div>
      <input
        id={`${id}-label`}
        className="input w-full"
        placeholder="Card title shown to members"
        value={titleValue}
        onChange={(e) => onTitleChange(e.target.value)}
      />
      <input
        id={id}
        className="input w-full"
        placeholder="https://www.youtube.com/watch?v=…"
        value={urlValue}
        onChange={(e) => onUrlChange(e.target.value)}
      />
      {previewVideo ? (
        <div className="aspect-video overflow-hidden rounded-xl bg-black ring-1 ring-[var(--border)]">
          <YoutubeAutoplayFrame className="h-full w-full" videoUrl={previewVideo} title={label} />
        </div>
      ) : (
        <p className="text-xs text-[var(--muted)] italic">Paste a YouTube URL to preview.</p>
      )}
    </div>
  );
}