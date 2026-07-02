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
      className={`text-xs text-[var(--muted)] hover:text-accent transition ${className}`}
      onClick={() => {
        window.location.href = logoutUrl();
      }}
      title="Sign out"
      aria-label="Sign out"
    >
      {compact ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        "Sign out"
      )}
    </button>
  );
}