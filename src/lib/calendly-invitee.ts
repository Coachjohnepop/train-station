import "server-only";

/**
 * Calendly API v2 — reschedule_url / cancel_url live on the invitee resource.
 *
 * Env:
 *   CALENDLY_API_TOKEN or CALENDLY_PERSONAL_ACCESS_TOKEN  — PAT from
 *     Calendly → Integrations & apps → API & webhooks → Personal access tokens
 *   CALENDLY_WEBHOOK_SIGNING_KEY — set after we create the webhook subscription
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

export type CalendlyMe = {
  uri: string;
  email: string | null;
  name: string | null;
  organization: string | null;
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

async function calendlyGet(url: string): Promise<unknown | null> {
  const token = calendlyApiToken();
  if (!token) return null;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    console.warn("[calendly-api] GET failed", res.status, url);
    return null;
  }
  return res.json();
}

export function parseCalendlyInviteeLinks(raw: unknown): CalendlyInviteeLinks {
  const root = asRecord(raw) || {};
  const payload = asRecord(root.payload) || asRecord(root.resource) || root;
  const invitee = asRecord(payload.invitee) || payload;
  const scheduledEventRaw = invitee.scheduled_event ?? invitee.scheduledEvent ?? payload.scheduled_event;
  const scheduledEvent = asRecord(scheduledEventRaw) || {};

  const eventUri =
    pickString(scheduledEvent.uri) ||
    (typeof scheduledEventRaw === "string" ? scheduledEventRaw : null) ||
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

export async function getCalendlyMe(): Promise<CalendlyMe | null> {
  const body = await calendlyGet("https://api.calendly.com/users/me");
  const resource = asRecord(asRecord(body)?.resource);
  const uri = pickString(resource?.uri);
  if (!uri) return null;
  return {
    uri,
    email: pickString(resource?.email),
    name: pickString(resource?.name),
    organization: pickString(resource?.current_organization, resource?.currentOrganization),
  };
}

export async function fetchCalendlyEvent(eventUri: string): Promise<{
  uri: string;
  startTime: string | null;
  endTime: string | null;
} | null> {
  const uri = eventUri.trim();
  if (!uri.startsWith("https://api.calendly.com/")) return null;
  const body = await calendlyGet(uri);
  const resource = asRecord(asRecord(body)?.resource) || asRecord(body);
  if (!resource) return null;
  return {
    uri: pickString(resource.uri) || uri,
    startTime: pickIso(resource.start_time, resource.startTime),
    endTime: pickIso(resource.end_time, resource.endTime),
  };
}

/** GET the invitee resource. No-op without a Calendly PAT. */
export async function fetchCalendlyInvitee(
  inviteeUri: string,
): Promise<CalendlyInviteeLinks | null> {
  const uri = inviteeUri.trim();
  if (!calendlyApiToken() || !uri.startsWith("https://api.calendly.com/")) return null;

  const body = await calendlyGet(uri);
  if (!body) return null;
  const parsed = parseCalendlyInviteeLinks(body);
  const links: CalendlyInviteeLinks = {
    ...parsed,
    inviteeUri: parsed.inviteeUri || uri,
  };
  if (!links.startTime && links.eventUri) {
    const event = await fetchCalendlyEvent(links.eventUri);
    if (event) {
      links.startTime = event.startTime || links.startTime;
      links.endTime = event.endTime || links.endTime;
      links.eventUri = event.uri || links.eventUri;
    }
  }
  return links;
}

/**
 * Find the latest active invitee for an email on Jeremy’s user calendar.
 */
export async function findCalendlyInviteeByEmail(
  email: string,
): Promise<CalendlyInviteeLinks | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !calendlyApiToken()) return null;
  const me = await getCalendlyMe();
  if (!me?.uri) return null;

  const params = new URLSearchParams({
    user: me.uri,
    invitee_email: normalized,
    status: "active",
    count: "20",
    sort: "start_time:desc",
  });
  const list = await calendlyGet(`https://api.calendly.com/scheduled_events?${params.toString()}`);
  const collection = asRecord(list)?.collection;
  const events = Array.isArray(collection) ? collection : [];

  for (const row of events) {
    const event = asRecord(row);
    const eventUri = pickString(event?.uri);
    if (!eventUri) continue;
    const inviteesBody = await calendlyGet(
      `${eventUri}/invitees?email=${encodeURIComponent(normalized)}&status=active`,
    );
    const invitees = asRecord(inviteesBody)?.collection;
    const first = Array.isArray(invitees) ? invitees[0] : null;
    if (!first) continue;
    const parsed = parseCalendlyInviteeLinks({ resource: first });
    return {
      ...parsed,
      eventUri: parsed.eventUri || eventUri,
      email: parsed.email || normalized,
      startTime:
        parsed.startTime || pickIso(event?.start_time, event?.startTime) || null,
      endTime: parsed.endTime || pickIso(event?.end_time, event?.endTime) || null,
    };
  }
  return null;
}

export async function enrichCalendlyLinks(input: {
  inviteeUri?: string | null;
  eventUri?: string | null;
  rescheduleUrl?: string | null;
  cancelUrl?: string | null;
  scheduledAt?: string | null;
  email?: string | null;
}): Promise<CalendlyInviteeLinks> {
  const base: CalendlyInviteeLinks = {
    inviteeUri: input.inviteeUri?.trim() || null,
    eventUri: input.eventUri?.trim() || null,
    rescheduleUrl: input.rescheduleUrl?.trim() || null,
    cancelUrl: input.cancelUrl?.trim() || null,
    email: input.email?.trim().toLowerCase() || null,
    name: null,
    startTime: input.scheduledAt?.trim() || null,
    endTime: null,
  };

  if (base.rescheduleUrl && base.startTime) return base;

  if (base.inviteeUri && (!base.rescheduleUrl || !base.startTime)) {
    const fetched = await fetchCalendlyInvitee(base.inviteeUri);
    if (fetched) {
      base.inviteeUri = fetched.inviteeUri || base.inviteeUri;
      base.eventUri = fetched.eventUri || base.eventUri;
      base.rescheduleUrl = fetched.rescheduleUrl || base.rescheduleUrl;
      base.cancelUrl = fetched.cancelUrl || base.cancelUrl;
      base.email = fetched.email || base.email;
      base.name = fetched.name || base.name;
      base.startTime = fetched.startTime || base.startTime;
      base.endTime = fetched.endTime || base.endTime;
    }
  }

  if (!base.rescheduleUrl && base.email) {
    const byEmail = await findCalendlyInviteeByEmail(base.email);
    if (byEmail) {
      base.inviteeUri = byEmail.inviteeUri || base.inviteeUri;
      base.eventUri = byEmail.eventUri || base.eventUri;
      base.rescheduleUrl = byEmail.rescheduleUrl || base.rescheduleUrl;
      base.cancelUrl = byEmail.cancelUrl || base.cancelUrl;
      base.name = byEmail.name || base.name;
      base.startTime = byEmail.startTime || base.startTime;
      base.endTime = byEmail.endTime || base.endTime;
    }
  }

  return base;
}

export type CalendlyWebhookSubscription = {
  uri: string;
  callbackUrl: string;
  state: string | null;
  events: string[];
};

export async function listCalendlyWebhookSubscriptions(): Promise<CalendlyWebhookSubscription[]> {
  const me = await getCalendlyMe();
  if (!me?.uri) return [];
  const params = new URLSearchParams({
    scope: "user",
    user: me.uri,
    count: "20",
  });
  const body = await calendlyGet(
    `https://api.calendly.com/webhook_subscriptions?${params.toString()}`,
  );
  const collection = asRecord(body)?.collection;
  if (!Array.isArray(collection)) return [];
  return collection
    .map((row) => {
      const r = asRecord(row);
      const uri = pickString(r?.uri);
      const callbackUrl = pickString(r?.callback_url, r?.url);
      if (!uri || !callbackUrl) return null;
      const events = Array.isArray(r?.events)
        ? r.events.filter((e): e is string => typeof e === "string")
        : [];
      return {
        uri,
        callbackUrl,
        state: pickString(r?.state),
        events,
      };
    })
    .filter((row): row is CalendlyWebhookSubscription => Boolean(row));
}

export async function createCalendlyWebhookSubscription(callbackUrl: string): Promise<{
  uri: string | null;
  signingKey: string | null;
  error?: string;
}> {
  const token = calendlyApiToken();
  const me = await getCalendlyMe();
  if (!token || !me?.uri) {
    return { uri: null, signingKey: null, error: "Calendly API token missing or /users/me failed." };
  }

  const res = await fetch("https://api.calendly.com/webhook_subscriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: callbackUrl,
      events: ["invitee.created", "invitee.canceled"],
      organization: me.organization || undefined,
      user: me.uri,
      scope: "user",
    }),
  });
  const body: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const rec = asRecord(body);
    const message =
      pickString(asRecord(rec?.title) ? null : rec?.message, rec?.title) ||
      `HTTP ${res.status}`;
    return { uri: null, signingKey: null, error: message };
  }
  const resource = asRecord(asRecord(body)?.resource) || asRecord(body);
  return {
    uri: pickString(resource?.uri),
    signingKey: pickString(resource?.signing_key, resource?.signingKey),
  };
}

export async function syncCalendlyBookingForEmail(email: string): Promise<{
  ok: boolean;
  detail: string;
  bookingId?: string;
  rescheduleUrl?: string | null;
  scheduledAt?: string | null;
}> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { ok: false, detail: "email required" };
  if (!calendlyApiToken()) {
    return { ok: false, detail: "CALENDLY_API_TOKEN is not set." };
  }

  const links = await findCalendlyInviteeByEmail(normalized);
  if (!links?.inviteeUri && !links?.rescheduleUrl) {
    return { ok: false, detail: `No active Calendly event for ${normalized}.` };
  }

  const { getAccountByEmail } = await import("@/lib/member-accounts-store");
  const {
    createBooking,
    findBookingByCalendlyInviteeUri,
    getAdminContact,
    getLatestMemberBooking,
    patchBookingCalendly,
  } = await import("@/lib/booking");

  const account = await getAccountByEmail(normalized);
  const userId = account?.userId || undefined;
  const existing =
    (links.inviteeUri ? await findBookingByCalendlyInviteeUri(links.inviteeUri) : null) ||
    (userId ? await getLatestMemberBooking(userId, normalized) : await getLatestMemberBooking(null, normalized));

  const contact = await getAdminContact();
  const scheduledAt = links.startTime ? new Date(links.startTime) : existing ? undefined : new Date();

  let bookingId = existing?.id;
  if (existing) {
    await patchBookingCalendly(existing.id, {
      scheduledAt: scheduledAt instanceof Date ? scheduledAt : undefined,
      calendlyInviteeUri: links.inviteeUri,
      calendlyEventUri: links.eventUri,
      calendlyRescheduleUrl: links.rescheduleUrl,
      calendlyCancelUrl: links.cancelUrl,
      status: "confirmed",
    });
  } else {
    const created = await createBooking({
      memberEmail: normalized,
      scheduledAt: scheduledAt instanceof Date ? scheduledAt : new Date(),
      adminEmail: contact.email,
      adminPhone: contact.phone || undefined,
      userId,
      notes: [
        "Calendly API sync",
        links.inviteeUri ? `calendly-invitee:${links.inviteeUri}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      status: "confirmed",
      calendlyInviteeUri: links.inviteeUri,
      calendlyEventUri: links.eventUri,
      calendlyRescheduleUrl: links.rescheduleUrl,
      calendlyCancelUrl: links.cancelUrl,
    });
    bookingId = typeof created.id === "string" ? created.id : String(created.id);
  }

  if (userId) {
    const { ensureMemberProfile, updateMemberProfile } = await import("@/lib/member-profiles-store");
    const profile = await ensureMemberProfile({
      userId,
      email: normalized,
      plan: "explorer",
    });
    if (!profile.introBookedAt) {
      await updateMemberProfile(userId, { introBookedAt: new Date().toISOString() });
    }
  }

  return {
    ok: true,
    detail: existing ? "updated" : "created",
    bookingId,
    rescheduleUrl: links.rescheduleUrl,
    scheduledAt: links.startTime,
  };
}
