export type CalendlyPrefill = {
  email?: string;
  name?: string;
};

declare global {
  interface Window {
    Calendly?: {
      initInlineWidget: (options: {
        url: string;
        parentElement: HTMLElement;
        prefill?: CalendlyPrefill;
        utm?: Record<string, string>;
      }) => void;
    };
  }
}

const CALENDLY_SCRIPT_SRC = "https://assets.calendly.com/assets/external/widget.js";

let scriptPromise: Promise<void> | null = null;

export function buildCalendlyEmbedUrl(
  baseUrl: string,
  opts?: {
    embedDomain?: string;
    prefill?: CalendlyPrefill;
    hideGdprBanner?: boolean;
  },
): string {
  const embedDomain =
    opts?.embedDomain ??
    (typeof window !== "undefined" ? window.location.hostname : "www.thetrainstation.co");
  try {
    const url = new URL(baseUrl);
    url.searchParams.set("embed_domain", embedDomain);
    url.searchParams.set("embed_type", "Inline");
    if (opts?.hideGdprBanner !== false) {
      url.searchParams.set("hide_gdpr_banner", "1");
    }
    if (opts?.prefill?.email) url.searchParams.set("email", opts.prefill.email);
    if (opts?.prefill?.name) url.searchParams.set("name", opts.prefill.name);
    return url.toString();
  } catch {
    return baseUrl;
  }
}

export function loadCalendlyWidgetScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Calendly) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CALENDLY_SCRIPT_SRC}"]`);
    if (existing) {
      if (window.Calendly) resolve();
      else existing.addEventListener("load", () => resolve(), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = CALENDLY_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Could not load scheduling widget."));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export function isCalendlyPostMessage(data: unknown): data is { event: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    "event" in data &&
    typeof (data as { event: unknown }).event === "string" &&
    (data as { event: string }).event.startsWith("calendly.")
  );
}

export function isCalendlyScheduledMessage(
  data: unknown,
): data is { event: "calendly.event_scheduled"; payload?: unknown } {
  return isCalendlyPostMessage(data) && data.event === "calendly.event_scheduled";
}

/** Details we can pull from Calendly’s browser postMessage (start time is optional). */
export type CalendlyScheduledDetails = {
  /** ISO start when present in the embed payload */
  scheduledAt: string | null;
  inviteeEmail: string | null;
  inviteeName: string | null;
  eventUri: string | null;
  inviteeUri: string | null;
  rescheduleUrl: string | null;
  cancelUrl: string | null;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function pickIso(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c !== "string" || !c.trim()) continue;
    const d = new Date(c);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

/**
 * Best-effort parse of calendly.event_scheduled postMessage.
 * Calendly often only sends resource URIs (not start time) unless the event object is expanded.
 */
export function parseCalendlyScheduledDetails(data: unknown): CalendlyScheduledDetails {
  const empty: CalendlyScheduledDetails = {
    scheduledAt: null,
    inviteeEmail: null,
    inviteeName: null,
    eventUri: null,
    inviteeUri: null,
    rescheduleUrl: null,
    cancelUrl: null,
  };
  if (!isCalendlyScheduledMessage(data)) return empty;

  const payload = asRecord((data as { payload?: unknown }).payload) || asRecord(data) || {};
  const event = asRecord(payload.event) || asRecord(payload.scheduled_event) || {};
  const invitee = asRecord(payload.invitee) || {};

  const scheduledAt = pickIso(
    event.start_time,
    event.startTime,
    invitee.start_time,
    invitee.startTime,
    payload.start_time,
    payload.event_start_time,
  );

  const eventUri =
    (typeof event.uri === "string" && event.uri) ||
    (typeof payload.event === "string" && payload.event) ||
    null;
  const inviteeUri =
    (typeof invitee.uri === "string" && invitee.uri) ||
    (typeof payload.invitee === "string" && payload.invitee) ||
    null;

  return {
    scheduledAt,
    inviteeEmail:
      (typeof invitee.email === "string" && invitee.email) ||
      (typeof payload.email === "string" && payload.email) ||
      null,
    inviteeName:
      (typeof invitee.name === "string" && invitee.name) ||
      (typeof payload.name === "string" && payload.name) ||
      null,
    eventUri,
    inviteeUri,
    rescheduleUrl:
      (typeof invitee.reschedule_url === "string" && invitee.reschedule_url) ||
      (typeof invitee.rescheduleUrl === "string" && invitee.rescheduleUrl) ||
      (typeof payload.reschedule_url === "string" && payload.reschedule_url) ||
      null,
    cancelUrl:
      (typeof invitee.cancel_url === "string" && invitee.cancel_url) ||
      (typeof invitee.cancelUrl === "string" && invitee.cancelUrl) ||
      (typeof payload.cancel_url === "string" && payload.cancel_url) ||
      null,
  };
}