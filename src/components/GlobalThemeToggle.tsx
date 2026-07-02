"use client";

import ThemeModeToggle from "@/components/ThemeModeToggle";

/** Fixed top-right theme control — present on every page via root layout. */
export default function GlobalThemeToggle() {
  return (
    <div
      className="pointer-events-none fixed right-3 top-3 z-[200] sm:right-4 sm:top-4"
      style={{ paddingTop: "max(0px, env(safe-area-inset-top))" }}
    >
      <div className="pointer-events-auto global-theme-toggle">
        <ThemeModeToggle />
      </div>
    </div>
  );
}