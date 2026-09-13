"use client";

import { useEffect, useState } from "react";
import { THEME_MODE_STORAGE_KEY, type ThemeMode } from "@/lib/membership-theme";

export default function ThemeModeToggle({ className = "" }: { className?: string }) {
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    const stored = localStorage.getItem(THEME_MODE_STORAGE_KEY);
    const initial: ThemeMode = stored === "light" ? "light" : "dark";
    setMode(initial);
    document.documentElement.setAttribute("data-theme-mode", initial);
  }, []);

  function toggle() {
    const next: ThemeMode = mode === "dark" ? "light" : "dark";
    setMode(next);
    localStorage.setItem(THEME_MODE_STORAGE_KEY, next);
    document.documentElement.setAttribute("data-theme-mode", next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`theme-mode-toggle ${className}`.trim()}
      aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={mode === "dark" ? "Light mode" : "Dark mode"}
    >
      {mode === "dark" ? <SunIcon /> : <MoonIcon />}
      <span className="theme-mode-toggle__label">{mode === "dark" ? "Light" : "Dark"}</span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      aria-hidden
      className="theme-mode-toggle__icon"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2.2M12 18.8V21M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M3 12h2.2M18.8 12H21M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="theme-mode-toggle__icon"
    >
      <path d="M16.4 13.6A6.4 6.4 0 0 1 10.4 4.8 7 7 0 1 0 19.2 16.4a6.4 6.4 0 0 1-2.8-2.8Z" />
    </svg>
  );
}