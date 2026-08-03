import { Suspense } from "react";
import BookClient from "./BookClient";

export default function MemberBookPage() {
  return (
    <Suspense
      fallback={
        <p className="mt-6 text-center text-sm text-[var(--muted)]">Loading booking…</p>
      }
    >
      <BookClient />
    </Suspense>
  );
}
