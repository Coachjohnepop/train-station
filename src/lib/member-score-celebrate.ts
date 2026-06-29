export type MemberScoreCelebrateDetail = {
  pointsEarned: number;
  totalPoints: number;
  label?: string;
};

/** Big burst + fly-to-Scores animation when points are earned; badge-only update otherwise. */
export function dispatchMemberScoreCelebrate(detail: MemberScoreCelebrateDetail) {
  if (detail.pointsEarned > 0) {
    window.dispatchEvent(new CustomEvent("member-score-celebrate", { detail }));
    return;
  }
  if (typeof detail.totalPoints === "number") {
    window.dispatchEvent(
      new CustomEvent("member-score-updated", { detail: { totalPoints: detail.totalPoints } }),
    );
  }
}