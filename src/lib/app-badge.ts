/**
 * Home-screen app icon badge (PWA Badging API).
 * Works on installed PWAs (iOS 16.4+, Chromium Android). No-op in plain browser tabs.
 */

export type AppBadgeNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function canUseAppBadge(): boolean {
  if (typeof navigator === "undefined") return false;
  const n = navigator as AppBadgeNavigator;
  return typeof n.setAppBadge === "function";
}

/** Show count on home-screen icon (0 or omit clears on some engines). */
export async function setHomeScreenBadge(count: number): Promise<void> {
  if (typeof navigator === "undefined") return;
  const n = navigator as AppBadgeNavigator;
  try {
    if (count > 0 && typeof n.setAppBadge === "function") {
      await n.setAppBadge(Math.min(count, 99));
      return;
    }
    if (typeof n.clearAppBadge === "function") {
      await n.clearAppBadge();
    }
  } catch {
    /* unsupported or permission edge */
  }
}

export async function clearHomeScreenBadge(): Promise<void> {
  await setHomeScreenBadge(0);
}
