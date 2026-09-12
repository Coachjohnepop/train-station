"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { AnalyticsEventInput, AnalyticsIngestPayload } from "@/lib/analytics-types";

const SESSION_COOKIE = "ts_analytics_sid";
const ANON_COOKIE = "ts_analytics_aid";
const LANDING_AB_COOKIE = "ts_landing";
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
  const explicit = params.get("utm_source") ?? undefined;
  const ref = typeof document !== "undefined" ? document.referrer : "";
  const facebook =
    Boolean(params.get("fbclid")) ||
    /facebook|fb\.com|instagram|l\.facebook/i.test(ref);
  return {
    utmSource: explicit || (facebook ? "facebook" : undefined),
    utmMedium:
      params.get("utm_medium") ?? (facebook && !explicit ? "social" : undefined),
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
  const flushRef = useRef<() => void>(() => {});
  const lastClickRef = useRef({ key: "", at: 0 });

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

    const landingVariant = readCookie(LANDING_AB_COOKIE) || undefined;

    const enqueue = (event: AnalyticsEventInput) => {
      queueRef.current.push({
        ...event,
        properties: {
          ...(event.properties || {}),
          ...(landingVariant ? { landingVariant } : {}),
        },
      });
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
          utmContent: utm.utmContent || landingVariant,
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

    const emitClick = (el: HTMLElement) => {
      const meta = clickTargetLabel(el);
      const key = `${meta.clickAction || ""}|${meta.elementText || ""}|${meta.clickHref || ""}`;
      const now = Date.now();
      if (key === lastClickRef.current.key && now - lastClickRef.current.at < 700) return;
      lastClickRef.current = { key, at: now };
      enqueue({
        eventType: "page_click",
        pagePath: pathname,
        pageTitle: document.title,
        pageSection: pageSection(pathname),
        referrer: document.referrer || undefined,
        ...meta,
      });
      void flush();
    };

    const onClick = (event: MouseEvent) => {
      const el = shouldTrackClick(event.target);
      if (el) emitClick(el);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      const el = shouldTrackClick(event.target);
      if (el) emitClick(el);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") void flush();
    };

    flushRef.current = () => {
      void flush();
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", () => void flush());

    const interval = window.setInterval(() => void flush(), FLUSH_MS);

    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("pointerup", onPointerUp, true);
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
    flushRef.current();
  }, [pathname, searchParams]);

  return null;
}