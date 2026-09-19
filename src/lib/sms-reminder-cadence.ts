/** Twilio program texts: how often this member wants them. Asked on the D&D card / intro. */

export const SMS_REMINDER_CADENCES = ["consistent", "minimum"] as const;
export type SmsReminderCadence = (typeof SMS_REMINDER_CADENCES)[number];

export function parseSmsReminderCadence(raw: unknown): SmsReminderCadence | null {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (v === "consistent" || v === "minimum") return v;
  return null;
}

/** Daily blast only when they asked for consistent. Unset + a time = legacy daily. */
export function wantsDailyProgramReminder(opts: {
  cadence: SmsReminderCadence | null | undefined;
  dailyReminderTime: string | null | undefined;
}): boolean {
  if (!opts.dailyReminderTime?.trim()) return false;
  if (opts.cadence === "minimum") return false;
  return true;
}

export const SMS_REMINDER_CADENCE_COPY = {
  ask: "Do they want a text every training day, or only the important ones (class, missed day, 15 minutes with you)?",
  consistent: "Consistent — every training day",
  minimum: "Minimum — class, missed day, booked session",
} as const;
