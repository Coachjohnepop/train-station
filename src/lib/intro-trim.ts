import type { CoachIntroSlotId } from "@/lib/coach-intro-slots";

/** Playback window for one coach intro slot. `endSec: null` = play to the file end. */
export type IntroTrim = {
  startSec: number;
  endSec: number | null;
};

export type IntroTrims = Partial<Record<CoachIntroSlotId, IntroTrim>>;

export const INTRO_MIN_TRIM_SEC = 0.5;

export const EMPTY_INTRO_TRIM: IntroTrim = { startSec: 0, endSec: null };

export function emptyIntroTrims(): IntroTrims {
  return {};
}

export function normalizeIntroTrim(raw: unknown): IntroTrim {
  if (!raw || typeof raw !== "object") return { ...EMPTY_INTRO_TRIM };
  const data = raw as { startSec?: unknown; endSec?: unknown };
  const startSec = Math.max(0, Number(data.startSec) || 0);
  const endRaw = data.endSec;
  const endSec =
    endRaw == null || endRaw === "" || !Number.isFinite(Number(endRaw))
      ? null
      : Math.max(startSec + INTRO_MIN_TRIM_SEC, Number(endRaw));
  return { startSec, endSec };
}

const SLOT_IDS: CoachIntroSlotId[] = [
  "overall",
  "free",
  "equipment",
  "measurements",
  "member",
  "business",
  "pro",
  "explorer",
];

export function normalizeIntroTrims(raw: unknown): IntroTrims {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const data = raw as Record<string, unknown>;
  const out: IntroTrims = {};
  for (const id of SLOT_IDS) {
    if (data[id] == null) continue;
    const trim = normalizeIntroTrim(data[id]);
    if (trim.startSec > 0 || trim.endSec != null) {
      out[id] = trim;
    }
  }
  return out;
}

export function introTrimForSlot(
  trims: IntroTrims | null | undefined,
  slotId: CoachIntroSlotId,
): IntroTrim {
  const hit = trims?.[slotId];
  if (slotId === "free" || slotId === "explorer") {
    return normalizeIntroTrim(trims?.free || trims?.explorer || hit);
  }
  return normalizeIntroTrim(hit);
}

export function introTrimWindow(
  trim: IntroTrim,
  durationSec?: number | null,
): { start: number; end: number | null } {
  const cap = durationSec && durationSec > 0 ? durationSec : null;
  let start = Math.max(0, Number(trim.startSec) || 0);
  let end =
    trim.endSec == null || !Number.isFinite(Number(trim.endSec))
      ? null
      : Math.max(0, Number(trim.endSec));
  if (cap != null) {
    start = Math.min(start, Math.max(0, cap - INTRO_MIN_TRIM_SEC));
    if (end != null) end = Math.min(end, cap);
  }
  if (end != null && end < start + INTRO_MIN_TRIM_SEC) {
    end = start + INTRO_MIN_TRIM_SEC;
    if (cap != null && end > cap) {
      end = cap;
      start = Math.max(0, end - INTRO_MIN_TRIM_SEC);
    }
  }
  return { start, end };
}

export function introTrimDurationSec(
  trim: IntroTrim,
  durationSec?: number | null,
): number | null {
  const { start, end } = introTrimWindow(trim, durationSec);
  if (end == null) return durationSec != null ? Math.max(0, durationSec - start) : null;
  return Math.max(0, end - start);
}

export function formatIntroTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  const whole = s < 10 ? `0${s.toFixed(1)}` : s.toFixed(1);
  return `${m}:${whole}`;
}

export function isDefaultIntroTrim(trim: IntroTrim | null | undefined): boolean {
  if (!trim) return true;
  return !(trim.startSec > 0.05) && trim.endSec == null;
}
