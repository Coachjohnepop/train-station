/** Pause/resume site background music while overlays (e.g. free-ticket prank) play video. */

export const BG_MUSIC_OVERLAY_EVENT = "ts-bg-music-overlay";

export function setBackgroundMusicOverlay(active: boolean): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(BG_MUSIC_OVERLAY_EVENT, { detail: { active } }),
  );
}