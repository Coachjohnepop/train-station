"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function MemberError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[member]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">Couldn&apos;t open your dashboard</h1>
      <p className="text-sm text-[var(--muted)]">
        Something went wrong loading this page. Try Today again — your workout and messages are
        still there.
      </p>
      {error.digest ? (
        <p className="text-[10px] text-[var(--muted)]">Ref: {error.digest}</p>
      ) : null}
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/member/today" className="btn-primary px-6">
          Open Today
        </Link>
        <button type="button" onClick={reset} className="btn-secondary px-6">
          Try again
        </button>
        <Link href="/" className="btn-ghost px-4 text-sm">
          Home
        </Link>
      </div>
    </div>
  );
}