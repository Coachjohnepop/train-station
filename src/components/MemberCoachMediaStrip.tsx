import Link from "next/link";
import MemberVideoHoverCard from "@/components/MemberVideoHoverCard";
import type { MemberContentConfig } from "@/lib/member-content-store";
import { pickDailyInspirationClip } from "@/lib/member-content-store";

export default function MemberCoachMediaStrip({
  content,
}: {
  content: Pick<
    MemberContentConfig,
    | "weeklyVideoUrl"
    | "weeklyVideoTitle"
    | "dinnerVideoUrl"
    | "dinnerVideoTitle"
    | "dailyInspirationClips"
    | "nutritionIntro"
    | "nutritionTiers"
  >;
}) {
  const hasWeekly = Boolean(content.weeklyVideoUrl?.trim());
  const hasDinner = Boolean(content.dinnerVideoUrl?.trim());
  const daily = pickDailyInspirationClip(content.dailyInspirationClips || []);
  const hasDaily = Boolean(daily?.videoUrl?.trim());
  const hasNutrition =
    Boolean(content.nutritionIntro?.trim()) || (content.nutritionTiers?.length ?? 0) > 0;

  if (!hasWeekly && !hasDinner && !hasDaily && !hasNutrition) return null;

  return (
    <div className="space-y-2">
      {(hasWeekly || hasDinner || hasDaily) && (
        <div
          className={`grid gap-2 ${
            [hasWeekly, hasDinner, hasDaily].filter(Boolean).length > 1 ? "sm:grid-cols-2" : ""
          }`}
        >
          {hasWeekly && content.weeklyVideoUrl ? (
            <MemberVideoHoverCard
              title={content.weeklyVideoTitle}
              subtitle="Updated anytime — hover or tap to watch"
              videoUrl={content.weeklyVideoUrl}
            />
          ) : null}
          {hasDinner && content.dinnerVideoUrl ? (
            <MemberVideoHoverCard
              title={content.dinnerVideoTitle}
              subtitle="Ideas for your journey"
              videoUrl={content.dinnerVideoUrl}
            />
          ) : null}
          {hasDaily && daily ? (
            <MemberVideoHoverCard
              title={daily.title}
              subtitle="Daily inspiration"
              videoUrl={daily.videoUrl}
            />
          ) : null}
        </div>
      )}

      {hasNutrition ? (
        <Link
          href="/member/nutrition"
          className="card flex items-center justify-between gap-3 p-4 transition hover:border-[var(--accent)]/50"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
              Nutrition
            </p>
            <p className="mt-1 text-sm font-semibold">Nutritional guidance</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Example daily diets by calorie level — tap to explore
            </p>
          </div>
          <span className="text-xs font-semibold text-[var(--accent)]">→</span>
        </Link>
      ) : null}
    </div>
  );
}