"use client";

export default function LogoutButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      className={`text-xs text-[var(--muted)] hover:text-accent transition ${className}`}
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
      }}
    >
      Sign out
    </button>
  );
}