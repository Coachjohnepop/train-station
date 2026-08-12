/**
 * Open the landing Free Quick Tour from nav (or anywhere).
 * Hero listens on the home page; other routes redirect home with ?tour=1.
 */

export const FREE_QUICK_TOUR_EVENT = "ts-open-free-quick-tour";

export function openFreeQuickTour() {
  if (typeof window === "undefined") return;

  const path = window.location.pathname || "/";
  const onHome = path === "/" || path === "";

  if (onHome) {
    window.dispatchEvent(new CustomEvent(FREE_QUICK_TOUR_EVENT));
    return;
  }

  const url = new URL("/", window.location.origin);
  url.searchParams.set("tour", "1");
  window.location.href = url.toString();
}
