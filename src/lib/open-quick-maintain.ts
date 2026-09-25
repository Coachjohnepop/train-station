export const QUICK_MAINTAIN_HREF = "/member/today#quick-maintain";

/** Already on Today: open the panel. Otherwise let the link navigate. */
export function openQuickMaintainInPlace(event: { preventDefault(): void }): void {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  const onToday = path === "/member/today" || path === "/member";
  if (!onToday) return;
  event.preventDefault();
  if (window.location.hash !== "#quick-maintain") {
    window.history.pushState(null, "", QUICK_MAINTAIN_HREF);
  }
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  window.setTimeout(() => {
    document.getElementById("quick-maintain")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 60);
}
