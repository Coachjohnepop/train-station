import { LAST_EMAIL_COOKIE } from "@/lib/remembered-email";

const STORAGE_KEY = "ts-email-history";
const COOKIE_KEY = "ts_email_hist";
const MAX_ENTRIES = 12;
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalize(email));
}

function readCookie(): string[] {
  if (typeof document === "undefined") return [];
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_KEY}=([^;]*)`));
    if (!match) return [];
    const parsed = JSON.parse(decodeURIComponent(match[1])) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is string => typeof e === "string" && isValidEmail(e));
  } catch {
    return [];
  }
}

function writeCookie(entries: string[]) {
  if (typeof document === "undefined") return;
  try {
    const payload = encodeURIComponent(JSON.stringify(entries.slice(0, MAX_ENTRIES)));
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE_KEY}=${payload}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
    if (entries[0]) {
      document.cookie = `${LAST_EMAIL_COOKIE}=${encodeURIComponent(entries[0])}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
    }
  } catch {
    /* ignore */
  }
}

function readLastEmailCookie(): string | null {
  if (typeof document === "undefined") return null;
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${LAST_EMAIL_COOKIE}=([^;]*)`));
    if (!match) return null;
    const email = decodeURIComponent(match[1]).trim().toLowerCase();
    return isValidEmail(email) ? email : null;
  } catch {
    return null;
  }
}

function readLocal(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is string => typeof e === "string" && isValidEmail(e));
  } catch {
    return [];
  }
}

function writeLocal(entries: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* ignore */
  }
}

function mergeLists(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const email of list) {
      const n = normalize(email);
      if (seen.has(n)) continue;
      seen.add(n);
      out.push(n);
      if (out.length >= MAX_ENTRIES) return out;
    }
  }
  return out;
}

function legacyEmails(): string[] {
  if (typeof localStorage === "undefined") return [];
  const out: string[] = [];
  try {
    for (const key of ["ts-login-email", "ts-signup-email"]) {
      const v = localStorage.getItem(key);
      if (v && isValidEmail(v)) out.push(v);
    }
  } catch {
    /* ignore */
  }
  return out;
}

/** Recent emails — localStorage with cookie mirror (best effort in private browsing). */
export function loadEmailHistory(): string[] {
  return mergeLists(readLocal(), readCookie(), legacyEmails());
}

export function getLastEmail(): string | null {
  return loadEmailHistory()[0] || readLastEmailCookie() || null;
}

export function rememberEmail(raw: string): void {
  const email = normalize(raw);
  if (!isValidEmail(email)) return;
  const next = mergeLists([email], loadEmailHistory());
  writeLocal(next);
  writeCookie(next);
}

export function filterEmailHistory(query: string): string[] {
  const q = normalize(query);
  const all = loadEmailHistory();
  if (!q) return all;
  return all.filter((e) => e.includes(q));
}