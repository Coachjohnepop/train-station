"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { OAuthProvider } from "@/lib/oauth/types";

type Props = {
  mode?: "login" | "signup";
  redirect?: string;
  plan?: string;
  className?: string;
};

const PROVIDER_META: Record<
  OAuthProvider,
  { label: string; className: string; icon: ReactNode }
> = {
  google: {
    label: "Continue with Google",
    className:
      "border-[var(--border)] bg-white text-[#1a1028] hover:bg-[#f8f6fc]",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        <path
          fill="#EA4335"
          d="M12 11.2v2.55h5.92c-.26 1.44-1.74 4.22-5.92 4.22-3.56 0-6.46-2.94-6.46-6.54S8.44 4.9 12 4.9c2.03 0 3.4.86 4.18 1.6l2.86-2.76C16.9 2.46 14.6 1.5 12 1.5 6.76 1.5 2.5 5.76 2.5 11s4.26 9.5 9.5 9.5c5.48 0 9.12-3.85 9.12-9.28 0-.62-.07-1.09-.16-1.52H12Z"
        />
        <path
          fill="#34A853"
          d="M3.98 7.34 1.4 9.45A9.47 9.47 0 0 0 2.5 11c0 1.55.37 3.02 1.03 4.32L6.5 13.2c-.28-.82-.44-1.7-.44-2.7 0-1.02.17-2 .47-2.86Z"
        />
        <path
          fill="#4A90E2"
          d="M12 22c2.7 0 4.97-.89 6.62-2.42l-3.14-2.58c-.87.58-1.98.98-3.48.98-2.67 0-4.93-1.8-5.74-4.22l-3.5 2.7C5.55 20.08 8.53 22 12 22Z"
        />
        <path
          fill="#FBBC05"
          d="M21.62 12.28c0-.62-.06-1.29-.16-1.86H12v2.55h5.4c-.23 1.22-.93 2.27-1.98 2.98l3.14 2.58c1.84-1.7 2.9-4.2 2.9-7.25Z"
        />
      </svg>
    ),
  },
  apple: {
    label: "Continue with Apple",
    className: "border-black bg-black text-white hover:bg-[#111]",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
        <path d="M16.87 12.64c.02 2.14 1.87 2.86 1.89 2.87-.02.06-.29.98-.96 1.94-.58.84-1.18 1.67-2.13 1.69-.93.02-1.23-.55-2.3-.55-1.07 0-1.4.53-2.28.57-.92.04-1.62-.93-2.21-1.77-1.2-1.74-2.12-4.91-.88-7.06.62-1.08 1.73-1.76 2.94-1.78.92-.02 1.78.61 2.3.61.53 0 1.52-.75 2.57-.64.44.02 1.68.18 2.47 1.36-.06.04-1.48.86-1.46 2.56ZM14.74 4.3c.5-.61.84-1.46.75-2.3-.72.03-1.6.48-2.12 1.09-.46.53-.86 1.39-.75 2.23.8.06 1.62-.41 2.12-1.02Z" />
      </svg>
    ),
  },
  facebook: {
    label: "Continue with Facebook",
    className: "border-[#1877F2] bg-[#1877F2] text-white hover:bg-[#166fe0]",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
        <path d="M13.5 22v-8.2h2.8l.42-3.2H13.5V8.77c0-.93.26-1.56 1.59-1.56h1.7V4.14c-.29-.04-1.3-.13-2.47-.13-2.45 0-4.12 1.49-4.12 4.22V10.6H7.8v3.2h2.3V22h3.4Z" />
      </svg>
    ),
  },
};

export default function OAuthButtons({ mode = "login", redirect = "", plan, className = "" }: Props) {
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/oauth/providers", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { providers: [] }))
      .then((data) => {
        if (cancelled) return;
        setProviders(Array.isArray(data.providers) ? data.providers : []);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const links = useMemo(() => {
    return providers.map((provider) => {
      const params = new URLSearchParams();
      if (redirect) params.set("redirect", redirect);
      if (plan) params.set("plan", plan);
      params.set("mode", mode);
      const qs = params.toString();
      return {
        provider,
        href: `/api/auth/oauth/${provider}${qs ? `?${qs}` : ""}`,
        ...PROVIDER_META[provider],
      };
    });
  }, [providers, redirect, plan, mode]);

  if (!loaded || links.length === 0) return null;

  return (
    <div className={`space-y-2.5 ${className}`}>
      {links.map((link) => (
        <a
          key={link.provider}
          href={link.href}
          className={`flex w-full items-center justify-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition ${link.className}`}
        >
          {link.icon}
          <span>{link.label}</span>
        </a>
      ))}
    </div>
  );
}