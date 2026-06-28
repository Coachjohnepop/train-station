"use client";

import { logoutUrl } from "@/lib/logout-url";

export default function LogoutButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      className={`text-xs text-[var(--muted)] hover:text-accent transition ${className}`}
      onClick={() => {
        window.location.href = logoutUrl();
      }}
    >
      Sign out
    </button>
  );
}