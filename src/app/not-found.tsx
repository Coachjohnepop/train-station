import Link from "next/link";

export default function NotFound() {
  return (
    <div className="app-shell-bg flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">The Train Station</p>
      <h1 className="text-2xl font-bold">That page isn&apos;t here</h1>
      <p className="max-w-sm text-sm text-[var(--muted)]">
        The link may be old. Tickets, login, and Today are still this way.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Link href="/" className="btn-ghost px-4 py-2 text-sm">
          Home
        </Link>
        <Link href="/join" className="btn-primary px-5 py-2 text-sm font-bold">
          Join
        </Link>
        <Link href="/login" className="btn-ghost px-4 py-2 text-sm">
          Log in
        </Link>
      </div>
    </div>
  );
}
