/**
 * Who still gets Train Station mail.
 * Workout mail was one Resend send per logged session, to the member and both coaches.
 * John only hears when a new person shows up. A password reset he asked for still sends.
 */

const JOHN_EMAILS = new Set([
  "john@thetrainstation.co",
  "john@lemonvoice.com",
  "john@bcxvoice.com",
]);

/** Never call Resend for these. Volume grew with every member session. */
const STOP_FOR_EVERYONE = new Set([
  "workout-complete",
  "coach-workoutLogged",
  "coach-warmupStarted",
]);

/** John stays on the new-person notes. Reset stays so he can get back in. */
const JOHN_STILL_RECEIVES = new Set([
  "coach-newMember",
  "lead",
  "password-reset",
]);

export type QuietMailDecision = {
  recipients: string[];
  /** Category is off for everybody. Caller should not write a notification row. */
  stoppedForEveryone: boolean;
};

function addressOnly(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  const angled = trimmed.match(/<([^>]+)>/);
  return (angled?.[1] || trimmed).trim();
}

export function expandMailRecipients(to: string | string[]): string[] {
  const parts = Array.isArray(to) ? to : [to];
  const out: string[] = [];
  for (const part of parts) {
    for (const bit of String(part || "").split(/[,;]/)) {
      const addr = addressOnly(bit);
      if (addr.includes("@")) out.push(addr);
    }
  }
  return [...new Set(out)];
}

export function recipientsAfterQuietPolicy(
  to: string | string[],
  category: string,
): QuietMailDecision {
  if (STOP_FOR_EVERYONE.has(category)) {
    return { recipients: [], stoppedForEveryone: true };
  }
  const all = expandMailRecipients(to);
  if (JOHN_STILL_RECEIVES.has(category)) {
    return { recipients: all, stoppedForEveryone: false };
  }
  return {
    recipients: all.filter((email) => !JOHN_EMAILS.has(email)),
    stoppedForEveryone: false,
  };
}
