"use client";

import { useState } from "react";
import { saveMemberContentAction } from "@/app/admin/landing/actions";
import YoutubeAutoplayFrame from "@/components/YoutubeAutoplayFrame";
import type { NutritionCalorieTier } from "@/lib/member-content-store";
import {
  DEFAULT_NUTRITION_DESK,
  isNutritionCalendlyUrl,
  type NutritionDesk,
} from "@/lib/nutrition-meals";
import { isYoutubeUrl } from "@/lib/youtube";

export default function AdminMemberContentPanel({
  initialWeeklyUrl = "",
  initialWeeklyTitle = "",
  initialDinnerUrl = "",
  initialDinnerTitle = "",
  initialNutritionIntro = "",
  initialNutritionTiers = [],
  initialNutritionDesk,
}: {
  initialWeeklyUrl?: string;
  initialWeeklyTitle?: string;
  initialDinnerUrl?: string;
  initialDinnerTitle?: string;
  initialNutritionIntro?: string;
  initialNutritionTiers?: NutritionCalorieTier[];
  initialNutritionDesk?: NutritionDesk;
}) {
  const [weeklyUrl, setWeeklyUrl] = useState(initialWeeklyUrl);
  const [weeklyTitle, setWeeklyTitle] = useState(initialWeeklyTitle);
  const [dinnerUrl, setDinnerUrl] = useState(initialDinnerUrl);
  const [dinnerTitle, setDinnerTitle] = useState(initialDinnerTitle);
  const [nutritionIntro, setNutritionIntro] = useState(initialNutritionIntro);
  const [tiers, setTiers] = useState<NutritionCalorieTier[]>(initialNutritionTiers);
  const [desk, setDesk] = useState<NutritionDesk>(
    initialNutritionDesk ?? { ...DEFAULT_NUTRITION_DESK },
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  function updateDesk(patch: Partial<NutritionDesk>) {
    setDesk((prev) => ({ ...prev, ...patch }));
  }

  function updateTier(index: number, patch: Partial<NutritionCalorieTier>) {
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function addTier() {
    setTiers((prev) => [
      ...prev,
      {
        id: `tier-${Date.now().toString(36)}`,
        calories: 2000,
        label: "New calorie day",
        sampleDay: "Breakfast:  · Lunch:  · Dinner:  · Snacks: ",
      },
    ]);
  }

  function removeTier(index: number) {
    setTiers((prev) => prev.filter((_, i) => i !== index));
  }

  function moveTier(index: number, dir: -1 | 1) {
    setTiers((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      const swap = next[index];
      next[index] = next[j];
      next[j] = swap;
      return next;
    });
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
    if (desk.calendlyUrl?.trim() && !isNutritionCalendlyUrl(desk.calendlyUrl)) {
      setError(true);
      setMessage("Nutrition appointment must be a Calendly link (https://calendly.com/…).");
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
      nutritionDesk: {
        ...desk,
        calendlyUrl: desk.calendlyUrl?.trim() || null,
      },
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
      if (result.storedNutritionDesk) setDesk(result.storedNutritionDesk);
      setMessage("Saved — live on member Nutrition now.");
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
            <strong className="text-[var(--text)]">Nutrition</strong> — page copy, meal labels, calorie
            days, custom meal planning, and Calendly on{" "}
            <span className="text-[var(--accent-fg)]">/member/nutrition</span>
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
          <p className="text-sm font-semibold text-[var(--text)]">Nutrition page</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Everything members see under Nutrition — titles, meal labels, calorie days, custom meal
            planning copy, and the Calendly appointment.
          </p>
        </div>
        <div>
          <label className="text-xs text-[var(--muted)]">Page / nav title</label>
          <input
            className="input mt-1 w-full"
            value={desk.pageTitle}
            onChange={(e) => updateDesk({ pageTitle: e.target.value })}
            placeholder="Nutrition"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--muted)]">Intro</label>
          <textarea
            className="input mt-1 min-h-[80px] w-full"
            value={nutritionIntro}
            onChange={(e) => setNutritionIntro(e.target.value)}
            placeholder="Short intro for the nutrition page…"
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div>
            <label className="text-xs text-[var(--muted)]">Breakfast label</label>
            <input
              className="input mt-1 w-full"
              value={desk.breakfastLabel}
              onChange={(e) => updateDesk({ breakfastLabel: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-[var(--muted)]">Lunch label</label>
            <input
              className="input mt-1 w-full"
              value={desk.lunchLabel}
              onChange={(e) => updateDesk({ lunchLabel: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-[var(--muted)]">Dinner label</label>
            <input
              className="input mt-1 w-full"
              value={desk.dinnerLabel}
              onChange={(e) => updateDesk({ dinnerLabel: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Calorie days
            </p>
            <button
              type="button"
              onClick={addTier}
              className="text-sm font-semibold text-[#7c3aed] hover:underline"
            >
              + Add calorie day
            </button>
          </div>
          {tiers.length === 0 ? (
            <p className="text-xs text-[var(--muted)] italic">
              No calorie days yet — add one so breakfast / lunch / dinner have ideas to show.
            </p>
          ) : null}
          {tiers.map((tier, index) => (
            <div
              key={tier.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/40 p-3 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-[var(--text)]">Day {index + 1}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => moveTier(index, -1)}
                    disabled={index === 0}
                    className="text-xs text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-40"
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    onClick={() => moveTier(index, 1)}
                    disabled={index === tiers.length - 1}
                    className="text-xs text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-40"
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTier(index)}
                    className="text-xs text-amber-400 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
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
                <label className="text-xs text-[var(--muted)]">
                  Sample day (use Breakfast: / Lunch: / Dinner: so the member menu can split them)
                </label>
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

      <div className="card space-y-4">
        <div>
          <p className="text-sm font-semibold text-[var(--text)]">Custom meal planning</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            This is the menu-advisory card. The button books a nutrition appointment on Calendly —
            paste Jeremy&apos;s nutrition event type below. Blank uses the intro-call calendar.
          </p>
        </div>
        <div>
          <label className="text-xs text-[var(--muted)]">Card title</label>
          <input
            className="input mt-1 w-full"
            value={desk.advisoryTitle}
            onChange={(e) => updateDesk({ advisoryTitle: e.target.value })}
            placeholder="Custom meal planning"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--muted)]">Card body</label>
          <textarea
            className="input mt-1 min-h-[80px] w-full"
            value={desk.advisoryBody}
            onChange={(e) => updateDesk({ advisoryBody: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-[var(--muted)]">Button label</label>
          <input
            className="input mt-1 w-full"
            value={desk.advisoryCta}
            onChange={(e) => updateDesk({ advisoryCta: e.target.value })}
            placeholder="Book a nutrition appointment"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--muted)]">Calendly URL for nutrition appointments</label>
          <input
            className="input mt-1 w-full"
            value={desk.calendlyUrl ?? ""}
            onChange={(e) => updateDesk({ calendlyUrl: e.target.value || null })}
            placeholder="https://calendly.com/jeremy-thetrainstation/…"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--muted)]">Disclaimer (footer)</label>
          <textarea
            className="input mt-1 min-h-[64px] w-full"
            value={desk.disclaimer}
            onChange={(e) => updateDesk({ disclaimer: e.target.value })}
          />
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