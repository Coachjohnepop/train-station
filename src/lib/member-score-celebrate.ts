export type MemberScoreCelebrateDetail = {
  pointsEarned: number;
  totalPoints: number;
  label?: string;
  /** Full workout complete — 3s fireworks before points fly to nav. */
  celebration?: "standard" | "workout-complete";
};

/** Big burst + fly-to-Scores animation when points are earned; badge-only update otherwise. */
export function dispatchMemberScoreCelebrate(detail: MemberScoreCelebrateDetail) {
  if (detail.pointsEarned > 0 || detail.celebration === "workout-complete") {
    window.dispatchEvent(new CustomEvent("member-score-celebrate", { detail }));
    return;
  }
  if (typeof detail.totalPoints === "number") {
    window.dispatchEvent(
      new CustomEvent("member-score-updated", { detail: { totalPoints: detail.totalPoints } }),
    );
  }
}