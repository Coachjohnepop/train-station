/**
 * Open the landing “Explore Content” fold (programs, services, footer).
 * Hero is the only three choices; nav hash links use this so targets exist.
 */

export const LANDING_EXPLORE_EVENT = "ts-open-landing-explore";

export function openLandingExplore() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LANDING_EXPLORE_EVENT));
}
