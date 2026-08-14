"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { AnalyticsEventInput, AnalyticsIngestPayload } from "@/lib/analytics-types";

const SESSION_COOKIE = "ts_analytics_sid";
const ANON_COOKIE = "ts_analytics_aid";
const FLUSH_MS = 4000;
const MAX_QUEUE = 40;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, days = 400) {
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function deviceType(): string {
  if (typeof window === "undefined") return "unknown";
  const w = window.innerWidth;
  if (w < 768) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

function pageSection(path: string): string {
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/member")) return "member";
  if (path.startsWith("/login") || path.startsWith("/signup")) return "auth";
  if (path === "/" || path.startsWith("/join") || path === "/free") return "landing";
  return "other";
}

function utmFromSearch(params: URLSearchParams) {
  return {
    utmSource: params.get("utm_source") ?? undefined,
    utmMedium: params.get("utm_medium") ?? undefined,
    utmCampaign: params.get("utm_campaign") ?? undefined,
    utmTerm: params.get("utm_term") ?? undefined,
    utmContent: params.get("utm_content") ?? undefined,
  };
}

function clickTargetLabel(el: HTMLElement): {
  elementText?: string;
  elementId?: string;
  elementRole?: string;
  clickHref?: string;
  clickAction?: string;
} {
  const action = el.getAttribute("data-analytics-action");
  const id = el.id || el.getAttribute("data-analytics-id") || undefined;
  const href =
    el instanceof HTMLAnchorElement
      ? el.href
      : el.closest("a") instanceof HTMLAnchorElement
        ? (el.closest("a") as HTMLAnchorElement).href
        : undefined;
  const text =
    el.getAttribute("data-analytics-label") ||
    el.getAttribute("aria-label") ||
    el.textContent?.replace(/\s+/g, " ").trim();
  const role =
    el.getAttribute("role") ||
    (el.tagName === "BUTTON" ? "button" : el.tagName === "A" ? "link" : "interactive");

  return {
    elementText: text ? text.slice(0, 240) : undefined,
    elementId: id,
    elementRole: role,
    clickHref: href,
    clickAction: action ?? undefined,
  };
}

function shouldTrackClick(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null;
  if (target.closest("[data-analytics-ignore]")) return null;

  const explicit = target.closest("[data-analytics-click]") as HTMLElement | null;
  if (explicit) return explicit;

  const interactive = target.closest(
    "a[href], button, [role='button'], input[type='submit'], [data-analytics-action]",
  ) as HTMLElement | null;
  if (!interactive) return null;
  if (interactive.closest("[data-analytics-ignore]")) return null;
  return interactive;
}

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queueRef = useRef<AnalyticsEventInput[]>([]);
  const flushingRef = useRef(false);
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    let sessionKey = readCookie(SESSION_COOKIE);
    if (!sessionKey) {
      sessionKey = randomId();
      writeCookie(SESSION_COOKIE, sessionKey);
    }
    let anonymousId = readCookie(ANON_COOKIE);
    if (!anonymousId) {
      anonymousId = randomId();
      writeCookie(ANON_COOKIE, anonymousId);
    }

    const enqueue = (event: AnalyticsEventInput) => {
      queueRef.current.push(event);
      if (queueRef.current.length >= MAX_QUEUE) {
        void flush();
      }
    };

    const buildPayload = (): AnalyticsIngestPayload => {
      const params = new URLSearchParams(searchParams.toString());
      const utm = utmFromSearch(params);
      return {
        session: {
          sessionKey: sessionKey!,
          anonymousId: anonymousId!,
          landingPath: pathname,
          referrer: document.referrer || undefined,
          deviceType: deviceType(),
          userAgent: navigator.userAgent.slice(0, 500),
          ...utm,
        },
        events: [],
      };
    };

    const flush = async () => {
      if (flushingRef.current || queueRef.current.length === 0) return;
      flushingRef.current = true;
      const batch = queueRef.current.splice(0, MAX_QUEUE);
      const payload = buildPayload();
      payload.events = batch;

      try {
        await fetch("/api/analytics/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        });
      } catch {
        queueRef.current.unshift(...batch);
      } finally {
        flushingRef.current = false;
      }
    };

    const onClick = (event: MouseEvent) => {
      const el = shouldTrackClick(event.target);
      if (!el) return;
      const meta = clickTargetLabel(el);
      enqueue({
        eventType: "page_click",
        pagePath: pathname,
        pageTitle: document.title,
        pageSection: pageSection(pathname),
        ...meta,
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") void flush();
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", () => void flush());

    const interval = window.setInterval(() => void flush(), FLUSH_MS);

    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", () => void flush());
      window.clearInterval(interval);
      void flush();
    };
  }, [pathname, searchParams]);

  useEffect(() => {
    const pathKey = `${pathname}?${searchParams.toString()}`;
    if (lastPathRef.current === pathKey) return;
    lastPathRef.current = pathKey;

    const params = new URLSearchParams(searchParams.toString());
    const utm = utmFromSearch(params);

    const event: AnalyticsEventInput = {
      eventType: "page_view",
      pagePath: pathname,
      pageTitle: typeof document !== "undefined" ? document.title : undefined,
      pageSection: pageSection(pathname),
      referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
      ...utm,
      deviceType: deviceType(),
    };

    queueRef.current.push(event);
  }, [pathname, searchParams]);

  return null;
}