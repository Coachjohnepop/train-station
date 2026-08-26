"use client";

import { logoutUrl } from "@/lib/logout-url";

export default function LogoutButton({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      className={[
        // Clear browser hover target: color shift + 10% grow
        "inline-flex items-center justify-center rounded-md text-xs font-medium",
        "text-[var(--muted)] transition-all duration-150 ease-out",
        "hover:scale-110 hover:text-rose-200 hover:bg-rose-500/20",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60",
        "active:scale-105",
        compact ? "p-1.5" : "px-2 py-1",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => {
        window.location.href = logoutUrl();
      }}
      title="Sign out"
      aria-label="Sign out"
    >
      <svg
        className={compact ? "logout-btn-icon" : "logout-btn-icon logout-btn-icon--optional"}
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        <path
          d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className={compact ? "sr-only" : "logout-btn-label"}>Sign out</span>
    </button>
  );
}