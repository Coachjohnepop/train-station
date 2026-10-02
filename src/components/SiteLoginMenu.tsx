"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { filterEmailHistory } from "@/lib/email-history";
import {
  groupLoginAccounts,
  historyMemberAccounts,
  loginAccountHref,
  loginAccountLabel,
  operatorLoginAccounts,
  signedInAccountHref,
  type LoginAccountOption,
} from "@/lib/login-accounts";

type Variant = "nav" | "nav-compact" | "panel" | "field";

type Props = {
  variant: Variant;
  signedIn?: boolean;
  currentEmail?: string | null;
  onPick?: (option: LoginAccountOption) => void;
  onNavigate?: () => void;
  className?: string;
};

function CaretIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path
        d="M2.2 4.2 6 8l3.8-3.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function SiteLoginMenu({
  variant,
  signedIn = false,
  currentEmail = null,
  onPick,
  onNavigate,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHistory(filterEmailHistory(""));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const options = useMemo(() => {
    const extras = variant === "field" ? historyMemberAccounts(history) : [];
    return [...operatorLoginAccounts(), ...extras];
  }, [history, variant]);
  const groups = useMemo(() => groupLoginAccounts(options), [options]);

  function choose(option: LoginAccountOption) {
    onPick?.(option);
    onNavigate?.();
    setOpen(false);
  }

  const triggerLabel = signedIn ? "Today" : "Sign in";
  const popoverClass =
    variant === "field"
      ? "mt-1 w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg"
      : `absolute z-50 mt-1 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg ${
          variant === "nav-compact" ? "right-0" : "left-0"
        }`;
  const menu = (
    <div
      role="menu"
      aria-label="Member, coach, and admin accounts"
      className={variant === "panel" ? "mt-1 space-y-2" : popoverClass}
    >
      {groups.map((group) => (
        <div key={group.workspace} role="group" aria-label={group.label}>
          <p
            className={`px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)] ${
              variant === "panel" ? "px-2" : ""
            }`}
          >
            {group.label}
          </p>
          {group.options.map((option) => {
            const label = loginAccountLabel(option);
            const href = signedIn
              ? signedInAccountHref(option, currentEmail)
              : loginAccountHref(option);
            const classNameItem =
              variant === "panel"
                ? "block rounded-lg px-2 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-2)]"
                : "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]";
            if (onPick) {
              return (
                <button
                  key={option.id}
                  type="button"
                  role="menuitem"
                  className={classNameItem}
                  onClick={() => choose(option)}
                >
                  <span className="truncate font-medium">{option.name}</span>
                  <span className="shrink-0 text-[11px] text-[var(--muted)]">
                    {group.label}
                  </span>
                </button>
              );
            }
            return (
              <Link
                key={option.id}
                href={href}
                role="menuitem"
                className={classNameItem}
                onClick={() => {
                  onNavigate?.();
                  setOpen(false);
                }}
              >
                <span className="truncate font-medium">{option.name}</span>
                <span className="sr-only">{label}</span>
              </Link>
            );
          })}
        </div>
      ))}
      {variant !== "field" && !signedIn ? (
        <Link
          href="/login"
          role="menuitem"
          className={
            variant === "panel"
              ? "block rounded-lg px-2 py-2 text-sm text-[var(--muted)] hover:bg-[var(--surface-2)]"
              : "block px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--surface-2)]"
          }
          onClick={() => {
            onNavigate?.();
            setOpen(false);
          }}
        >
          Another email…
        </Link>
      ) : null}
    </div>
  );

  if (variant === "panel") {
    return (
      <div ref={rootRef} className={className}>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--surface-2)]"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span>{triggerLabel}</span>
          <CaretIcon open={open} />
        </button>
        {open ? menu : null}
      </div>
    );
  }

  if (variant === "field") {
    return (
      <div ref={rootRef} className={`pointer-events-none absolute inset-0 z-20 ${className}`}>
        <button
          type="button"
          className="pointer-events-auto absolute inset-y-0 right-0 flex min-w-11 items-center justify-center px-3 text-[var(--muted)] hover:text-[var(--text)]"
          aria-label="Choose member, coach, or admin account"
          aria-haspopup="menu"
          aria-expanded={open}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setOpen((value) => !value)}
        >
          <CaretIcon open={open} />
        </button>
        {open ? (
          <div className="pointer-events-auto absolute left-0 right-0 top-full z-50">{menu}</div>
        ) : null}
      </div>
    );
  }

  const navClass =
    variant === "nav-compact"
      ? "landing-nav__link landing-nav__link--compact"
      : "landing-nav__link text-[var(--muted)]";

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        className={`${navClass} gap-1`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${triggerLabel} — member, coach, or admin`}
        onClick={() => setOpen((value) => !value)}
      >
        {triggerLabel}
        <CaretIcon open={open} />
      </button>
      {open ? menu : null}
    </div>
  );
}
