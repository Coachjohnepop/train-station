import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import {
  calendlyInviteeNoteMarker,
  createBooking,
  findBookingByCalendlyInviteeUri,
  getAdminContact,
  updateBookingStatus,
} from "@/lib/booking";
import { notifyCoachIntakeReady } from "@/lib/coach-member-notify";
import { getAccountByEmail } from "@/lib/member-accounts-store";
import { ensureMemberProfile, updateMemberProfile } from "@/lib/member-profiles-store";
import { normalizeSignupPlan, signupPlanLabel } from "@/lib/signup-plans";
import { awardGamificationPoints } from "@/lib/member-gamification-store";

/**
 * Calendly webhook processing (invitee.created / invitee.canceled).
 *
 * Env:
 * - CALENDLY_WEBHOOK_SIGNING_KEY — from Calendly subscription (preferred)
 * - CALENDLY_WEBHOOK_SECRET — optional shared secret query ?secret= (dev fallback)
 */

export type CalendlyWebhookProcessResult = {
  ok: true;
  event: string;
  action: "created" | "canceled" | "ignored" | "duplicate";
  bookingId?: string;
  scheduledAt?: string | null;
  memberEmail?: string | null;
  notified?: boolean;
  detail?: string;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function pickString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function pickIso(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v !== "string" || !v.trim()) continue;
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

/**
 * Verify Calendly-Webhook-Signature: t=TIMESTAMP,v1=HEX
 * signed payload = `${t}.${rawBody}` with HMAC-SHA256 + signing key.
 */
export function verifyCalendlyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  signingKey: string,
  opts?: { maxSkewSec?: number },
): { ok: true } | { ok: false; error: string } {
  if (!signatureHeader?.trim()) {
    return { ok: false, error: "Missing Calendly-Webhook-Signature header." };
  }
  if (!signingKey.trim()) {
    return { ok: false, error: "CALENDLY_WEBHOOK_SIGNING_KEY is not configured." };
  }

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, ...rest] = p.trim().split("=");
      return [k, rest.join("=")];
    }),
  ) as Record<string, string>;

  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) {
    return { ok: false, error: "Malformed Calendly-Webhook-Signature." };
  }

  const maxSkew = opts?.maxSkewSec ?? 60 * 5;
  const ts = Number(t);
  if (!Number.isFinite(ts)) {
    return { ok: false, error: "Invalid signature timestamp." };
  }
  const skew = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (skew > maxSkew) {
    return { ok: false, error: "Webhook signature timestamp too old." };
  }

  const expected = createHmac("sha256", signingKey).update(`${t}.${rawBody}`).digest("hex");
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(v1, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, error: "Webhook signature mismatch." };
    }
  } catch {
    return { ok: false, error: "Webhook signature comparison failed." };
  }
  return { ok: true };
}

export function calendlyWebhookSigningKey(): string {
  return process.env.CALENDLY_WEBHOOK_SIGNING_KEY?.trim() || "";
}

export function calendlyWebhookSharedSecret(): string {
  return process.env.CALENDLY_WEBHOOK_SECRET?.trim() || "";
}

/** Parse invitee email, name, start/end from invitee.created payload (v2 shapes). */
export function parseCalendlyInviteePayload(body: unknown): {
  eventType: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  inviteeUri: string | null;
  eventUri: string | null;
  startTime: string | null;
  endTime: string | null;
  timezone: string | null;
  rescheduleUrl: string | null;
  cancelUrl: string | null;
  canceled: boolean;
} {
  const root = asRecord(body) || {};
  const eventType = pickString(root.event) || "";
  const payload = asRecord(root.payload) || root;
  const scheduledEvent =
    asRecord(payload.scheduled_event) ||
    asRecord(payload.scheduledEvent) ||
    asRecord(payload.event) ||
    {};

  // Sometimes `payload.event` is just a URI string
  const eventUri =
    pickString(scheduledEvent.uri) ||
    (typeof payload.event === "string" ? payload.event : null) ||
    null;

  const startTime = pickIso(
    scheduledEvent.start_time,
    scheduledEvent.startTime,
    payload.start_time,
    asRecord(payload.calendar_event)?.start_time,
  );
  const endTime = pickIso(
    scheduledEvent.end_time,
    scheduledEvent.endTime,
    payload.end_time,
    asRecord(payload.calendar_event)?.end_time,
  );

  const phone =
    pickString(payload.text_reminder_number, payload.phone) ||
    pickString(
      ...(Array.isArray(payload.questions_and_answers)
        ? (payload.questions_and_answers as unknown[]).map((qa) => {
            const row = asRecord(qa);
            const q = String(row?.question || "").toLowerCase();
            if (q.includes("phone")) return row?.answer;
            return null;
          })
        : []),
    );

  return {
    eventType,
    email: pickString(payload.email)?.toLowerCase() || null,
    name: pickString(payload.name) || null,
    phone,
    inviteeUri: pickString(payload.uri) || null,
    eventUri,
    startTime,
    endTime,
    timezone: pickString(payload.timezone, scheduledEvent.timezone) || null,
    rescheduleUrl: pickString(payload.reschedule_url, payload.rescheduleUrl) || null,
    cancelUrl: pickString(payload.cancel_url, payload.cancelUrl) || null,
    canceled:
      eventType === "invitee.canceled" ||
      pickString(payload.status) === "canceled" ||
      Boolean(payload.canceled),
  };
}

function durationMinutes(startIso: string, endIso: string | null): number {
  if (!endIso) return 15;
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 15;
  return Math.max(5, Math.round(ms / 60000));
}

export async function processCalendlyWebhookBody(
  body: unknown,
): Promise<CalendlyWebhookProcessResult> {
  const parsed = parseCalendlyInviteePayload(body);
  const event = parsed.eventType || "unknown";

  if (event !== "invitee.created" && event !== "invitee.canceled") {
    return { ok: true, event, action: "ignored", detail: `Unhandled event ${event}` };
  }

  if (!parsed.email) {
    return { ok: true, event, action: "ignored", detail: "No invitee email in payload" };
  }

  if (event === "invitee.canceled") {
    if (parsed.inviteeUri) {
      const existing = await findBookingByCalendlyInviteeUri(parsed.inviteeUri);
      if (existing && existing.status !== "cancelled") {
        await updateBookingStatus(existing.id, "cancelled");
        return {
          ok: true,
          event,
          action: "canceled",
          bookingId: existing.id,
          memberEmail: parsed.email,
          scheduledAt: parsed.startTime,
        };
      }
    }
    return {
      ok: true,
      event,
      action: "ignored",
      detail: "No matching booking to cancel",
      memberEmail: parsed.email,
    };
  }

  // Embed often omits start_time / reschedule_url. Fill from Calendly API when we have a PAT.
  let startTime = parsed.startTime;
  let rescheduleUrl = parsed.rescheduleUrl;
  let cancelUrl = parsed.cancelUrl;
  let eventUri = parsed.eventUri;
  if (parsed.inviteeUri && (!startTime || !rescheduleUrl)) {
    try {
      const { enrichCalendlyLinks } = await import("@/lib/calendly-invitee");
      const filled = await enrichCalendlyLinks({
        inviteeUri: parsed.inviteeUri,
        eventUri: parsed.eventUri,
        rescheduleUrl: parsed.rescheduleUrl,
        cancelUrl: parsed.cancelUrl,
        scheduledAt: parsed.startTime,
        email: parsed.email,
      });
      startTime = filled.startTime || startTime;
      rescheduleUrl = filled.rescheduleUrl || rescheduleUrl;
      cancelUrl = filled.cancelUrl || cancelUrl;
      eventUri = filled.eventUri || eventUri;
    } catch (e) {
      console.warn("[calendly-webhook] API enrich failed", e);
    }
  }

  // invitee.created — keep going without start_time if we at least have a reschedule URL.
  if (!startTime && !rescheduleUrl) {
    return {
      ok: true,
      event,
      action: "ignored",
      detail: "invitee.created missing start_time",
      memberEmail: parsed.email,
    };
  }

  if (parsed.inviteeUri) {
    const existing = await findBookingByCalendlyInviteeUri(parsed.inviteeUri);
    if (existing) {
      try {
        const { patchBookingCalendly } = await import("@/lib/booking");
        await patchBookingCalendly(existing.id, {
          scheduledAt: startTime ? new Date(startTime) : undefined,
          calendlyInviteeUri: parsed.inviteeUri,
          calendlyEventUri: eventUri,
          calendlyRescheduleUrl: rescheduleUrl,
          calendlyCancelUrl: cancelUrl,
        });
      } catch {
        /* ignore */
      }
      if (rescheduleUrl && parsed.email) {
        try {
          const { sendMemberIntroBookedEmail } = await import("@/lib/member-booking-email");
          await sendMemberIntroBookedEmail({
            email: parsed.email,
            name: parsed.name,
            scheduledAt: startTime,
            rescheduleUrl,
            userId: existing.userId ?? undefined,
          });
        } catch (e) {
          console.warn("[calendly-webhook] member booking email failed", e);
        }
      }
      return {
        ok: true,
        event,
        action: "duplicate",
        bookingId: existing.id,
        memberEmail: parsed.email,
        scheduledAt: startTime,
        notified: false,
        detail: "Already processed this Calendly invitee",
      };
    }
  }

  const account = await getAccountByEmail(parsed.email);
  const userId = account?.userId || undefined;
  const contact = await getAdminContact();
  const notesParts = [
    "Calendly webhook",
    parsed.inviteeUri ? calendlyInviteeNoteMarker(parsed.inviteeUri) : null,
    eventUri ? `event:${eventUri}` : null,
    parsed.timezone ? `tz:${parsed.timezone}` : null,
  ].filter(Boolean);

  const startIso = startTime || new Date().toISOString();
  const booking = await createBooking({
    memberEmail: parsed.email,
    memberPhone: parsed.phone || undefined,
    scheduledAt: new Date(startIso),
    durationMin: startTime ? durationMinutes(startIso, parsed.endTime) : 15,
    adminEmail: contact.email,
    adminPhone: contact.phone || undefined,
    userId,
    notes: notesParts.join(" · "),
    status: "confirmed",
    calendlyInviteeUri: parsed.inviteeUri,
    calendlyEventUri: eventUri,
    calendlyRescheduleUrl: rescheduleUrl,
    calendlyCancelUrl: cancelUrl,
  });

  let notified = false;
  if (userId) {
    const profile = await ensureMemberProfile({
      userId,
      email: parsed.email,
      plan: normalizeSignupPlan(null),
    });
    await updateMemberProfile(userId, {
      introBookedAt: profile.introBookedAt || new Date().toISOString(),
      coachMeetingRequestedAt: null,
      coachMeetingRequestedBy: null,
      coachMeetingRequestNote: null,
    });

    await notifyCoachIntakeReady({
      userId,
      name: parsed.name || account?.name || parsed.email,
      email: parsed.email,
      plan: signupPlanLabel(profile.plan),
      paymentStatus: profile.paymentStatus,
      scheduledAt: startTime || startIso,
      bookingSource: "calendly",
      phone: parsed.phone || account?.phone || profile.phone || null,
    });
    notified = true;

    try {
      const { sendMemberIntroBookedEmail } = await import("@/lib/member-booking-email");
      await sendMemberIntroBookedEmail({
        email: parsed.email,
        name: parsed.name || account?.name,
        scheduledAt: startTime || startIso,
        rescheduleUrl,
        userId,
      });
    } catch (e) {
      console.warn("[calendly-webhook] member booking email failed", e);
    }

    try {
      await awardGamificationPoints({
        userId,
        eventId: "intake:scheduled",
        type: "intake_scheduled",
        label: "Booked intro call",
      });
    } catch (e) {
      console.warn("[calendly-webhook] gamification award failed", e);
    }
  } else {
    // Unknown email — still email coach (no Messages thread without a member account).
    await notifyCoachIntakeReady({
      userId: "calendly-guest",
      name: parsed.name || parsed.email,
      email: parsed.email,
      plan: "Unknown (not a signed-up member yet)",
      paymentStatus: "none",
      scheduledAt: startTime,
      bookingSource: "calendly",
      phone: parsed.phone,
      skipInApp: true,
    });
    notified = true;
  }

  return {
    ok: true,
    event,
    action: "created",
    bookingId: typeof booking.id === "string" ? booking.id : String(booking.id),
    memberEmail: parsed.email,
    scheduledAt: startTime,
    notified,
  };
}
