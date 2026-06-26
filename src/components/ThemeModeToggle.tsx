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
      <span aria-hidden>{mode === "dark" ? "☀" : "☾"}</span>
      <span className="theme-mode-toggle__label">{mode === "dark" ? "Light" : "Dark"}</span>
    </button>
  );
}