import "server-only";

/**
 * Calendly invitee resource — reschedule_url / cancel_url live here.
 * Webhook invitee.created usually includes them. The browser embed often
 * only sends resource URIs; we GET the invitee when a PAT is set.
 *
 * Env: CALENDLY_API_TOKEN or CALENDLY_PERSONAL_ACCESS_TOKEN
 */

export type CalendlyInviteeLinks = {
  inviteeUri: string | null;
  eventUri: string | null;
  rescheduleUrl: string | null;
  cancelUrl: string | null;
  email: string | null;
  name: string | null;
  startTime: string | null;
  endTime: string | null;
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

export function calendlyApiToken(): string {
  return (
    process.env.CALENDLY_API_TOKEN?.trim() ||
    process.env.CALENDLY_PERSONAL_ACCESS_TOKEN?.trim() ||
    ""
  );
}

export function parseCalendlyInviteeLinks(raw: unknown): CalendlyInviteeLinks {
  const root = asRecord(raw) || {};
  const payload = asRecord(root.payload) || asRecord(root.resource) || root;
  const invitee = asRecord(payload.invitee) || payload;
  const scheduledEvent =
    asRecord(invitee.scheduled_event) ||
    asRecord(invitee.scheduledEvent) ||
    asRecord(payload.scheduled_event) ||
    asRecord(payload.scheduledEvent) ||
    asRecord(payload.event) ||
    {};

  const eventUri =
    pickString(scheduledEvent.uri) ||
    (typeof payload.event === "string" ? payload.event : null) ||
    pickString(invitee.event) ||
    null;

  const inviteeUri =
    pickString(invitee.uri, payload.uri) ||
    (typeof payload.invitee === "string" ? payload.invitee : null) ||
    null;

  return {
    inviteeUri,
    eventUri,
    rescheduleUrl: pickString(
      invitee.reschedule_url,
      invitee.rescheduleUrl,
      payload.reschedule_url,
      payload.rescheduleUrl,
    ),
    cancelUrl: pickString(
      invitee.cancel_url,
      invitee.cancelUrl,
      payload.cancel_url,
      payload.cancelUrl,
    ),
    email: pickString(invitee.email, payload.email)?.toLowerCase() || null,
    name: pickString(invitee.name, payload.name),
    startTime: pickIso(
      scheduledEvent.start_time,
      scheduledEvent.startTime,
      invitee.start_time,
      payload.start_time,
    ),
    endTime: pickIso(
      scheduledEvent.end_time,
      scheduledEvent.endTime,
      invitee.end_time,
      payload.end_time,
    ),
  };
}

/** GET the invitee resource. No-op without a Calendly PAT. */
export async function fetchCalendlyInvitee(
  inviteeUri: string,
): Promise<CalendlyInviteeLinks | null> {
  const token = calendlyApiToken();
  const uri = inviteeUri.trim();
  if (!token || !uri.startsWith("https://api.calendly.com/")) return null;

  try {
    const res = await fetch(uri, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn("[calendly-invitee] GET failed", res.status, uri);
      return null;
    }
    const body: unknown = await res.json();
    const parsed = parseCalendlyInviteeLinks(body);
    return {
      ...parsed,
      inviteeUri: parsed.inviteeUri || uri,
    };
  } catch (e) {
    console.warn("[calendly-invitee] GET error", e);
    return null;
  }
}

export async function enrichCalendlyLinks(input: {
  inviteeUri?: string | null;
  eventUri?: string | null;
  rescheduleUrl?: string | null;
  cancelUrl?: string | null;
  scheduledAt?: string | null;
}): Promise<CalendlyInviteeLinks> {
  const base: CalendlyInviteeLinks = {
    inviteeUri: input.inviteeUri?.trim() || null,
    eventUri: input.eventUri?.trim() || null,
    rescheduleUrl: input.rescheduleUrl?.trim() || null,
    cancelUrl: input.cancelUrl?.trim() || null,
    email: null,
    name: null,
    startTime: input.scheduledAt?.trim() || null,
    endTime: null,
  };
  if (base.rescheduleUrl || !base.inviteeUri) return base;
  const fetched = await fetchCalendlyInvitee(base.inviteeUri);
  if (!fetched) return base;
  return {
    inviteeUri: fetched.inviteeUri || base.inviteeUri,
    eventUri: fetched.eventUri || base.eventUri,
    rescheduleUrl: fetched.rescheduleUrl || base.rescheduleUrl,
    cancelUrl: fetched.cancelUrl || base.cancelUrl,
    email: fetched.email,
    name: fetched.name,
    startTime: fetched.startTime || base.startTime,
    endTime: fetched.endTime,
  };
}
