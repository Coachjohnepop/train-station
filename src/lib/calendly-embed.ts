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
  embedDomain = typeof window !== "undefined" ? window.location.hostname : "www.thetrainstation.co",
): string {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set("embed_domain", embedDomain);
    url.searchParams.set("embed_type", "Inline");
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
): data is { event: "calendly.event_scheduled" } {
  return isCalendlyPostMessage(data) && data.event === "calendly.event_scheduled";
}