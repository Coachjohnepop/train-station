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
  >;
}) {
  const hasWeekly = Boolean(content.weeklyVideoUrl?.trim());
  const hasDinner = Boolean(content.dinnerVideoUrl?.trim());
  const daily = pickDailyInspirationClip(content.dailyInspirationClips || []);
  const hasDaily = Boolean(daily?.videoUrl?.trim());

  if (!hasWeekly && !hasDinner && !hasDaily) return null;

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
    </div>
  );
}