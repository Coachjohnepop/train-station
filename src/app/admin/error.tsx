"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">Couldn&apos;t open this coach page</h1>
      <p className="text-sm text-[var(--muted)]">
        The dashboard and Today floor are still there. Try again, or go back to Dashboard.
      </p>
      {error.digest ? (
        <p className="text-[10px] text-[var(--muted)]">Ref: {error.digest}</p>
      ) : null}
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/admin/day" className="btn-primary px-6">
          Dashboard
        </Link>
        <button type="button" onClick={reset} className="btn-secondary px-6">
          Try again
        </button>
        <Link href="/admin/today" className="btn-ghost px-4 text-sm">
          Go to Today
        </Link>
      </div>
    </div>
  );
}
