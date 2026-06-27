import "server-only";

import {
  LAST_EMAIL_COOKIE,
  normalizeRememberedEmail,
  rememberedEmailCookieOptions,
} from "@/lib/remembered-email";

export const EMAIL_HISTORY_COOKIE = "ts_email_hist";
const MAX_ENTRIES = 12;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase());
}

function parseHistoryRaw(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const decoded = raw.includes("%") ? decodeURIComponent(raw) : raw;
    const parsed = JSON.parse(decoded) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is string => typeof entry === "string" && isValidEmail(entry))
      .map((entry) => entry.trim().toLowerCase());
  } catch {
    return [];
  }
}

function mergeHistory(rawEmail: string, existing: string[] = []): string[] {
  const email = normalizeRememberedEmail(rawEmail);
  if (!email) return existing;

  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of [email, ...existing]) {
    const normalized = entry.trim().toLowerCase();
    if (!isValidEmail(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
    if (out.length >= MAX_ENTRIES) break;
  }
  return out;
}

export function readEmailHistoryFromRequestCookies(
  get: (name: string) => { value: string } | undefined,
): string[] {
  return parseHistoryRaw(get(EMAIL_HISTORY_COOKIE)?.value);
}

/** Mirror recent emails in cookies — works in private browsing (no localStorage). */
export function applyEmailHistoryCookies(
  res: { cookies: { set: (name: string, value: string, opts?: object) => void } },
  rawEmail: string,
  existingHistory: string[] = [],
) {
  const email = normalizeRememberedEmail(rawEmail);
  if (!email) return;

  const history = mergeHistory(email, existingHistory);
  const opts = rememberedEmailCookieOptions();

  res.cookies.set(LAST_EMAIL_COOKIE, email, opts);
  res.cookies.set(EMAIL_HISTORY_COOKIE, JSON.stringify(history), opts);
}