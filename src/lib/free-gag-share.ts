/** Viral Free-ticket share — the gag is OUR membership, never YouTube. */

export const FREE_GAG_SHARE_PATH = "/free";

export const FREE_GAG_SHARE_TITLE = "You got a Free ticket — The Train Station";

export const FREE_GAG_SHARE_TEXT =
  "Never gonna give you up. It's a real Free Explorer membership with Coach Jeremy. Open your ticket:";

export const FREE_GAG_OG_TITLE = "You got a Free ticket 🚂 The Train Station";

export const FREE_GAG_OG_DESCRIPTION =
  "Never gonna give you up — it's a real Free Explorer membership with Coach Jeremy. Tap to open your ticket.";

/** Share preview image — our Free seat, not Rick Astley. */
export const FREE_GAG_OG_IMAGE = "/images/tickets/free.jpg";

export function freeGagShareOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://www.thetrainstation.co"
  );
}

export function freeGagShareUrl(origin?: string): string {
  const base = (origin || freeGagShareOrigin()).replace(/\/$/, "");
  return `${base}${FREE_GAG_SHARE_PATH}?utm_source=gag&utm_medium=share&utm_campaign=free_ticket`;
}

export function freeGagShareData(origin?: string): ShareData {
  return {
    title: FREE_GAG_SHARE_TITLE,
    text: FREE_GAG_SHARE_TEXT,
    url: freeGagShareUrl(origin),
  };
}
