import type { Metadata } from "next";
import Link from "next/link";
import LandingSiteFooter from "@/components/LandingSiteFooter";
import {
  SEARCH_THIRD_WORD_ALIASES,
  SEARCH_THIRD_WORDS,
} from "@/lib/search-third-words";

export const metadata: Metadata = {
  title: "Find The Train Station — fitness, workout, Jeremy Byrd",
  description:
    "If someone says look me up on The Train Station, add a third word: fitness, workout, exercise, program, weight loss, or Jeremy Byrd. That search is this site — thetrainstation.co.",
};

const WORDS = [...SEARCH_THIRD_WORDS, ...SEARCH_THIRD_WORD_ALIASES];

export default function FindTheTrainStationPage() {
  return (
    <div className="app-shell-bg min-h-screen text-[var(--text)]">
      <main className="mx-auto max-w-2xl px-6 py-12">
        <Link href="/" className="text-sm text-[var(--accent-fg)] hover:text-[var(--text)]">
          ← The Train Station
        </Link>
        <p className="mt-8 text-[10px] font-extrabold uppercase tracking-[0.35em] text-[var(--muted)]">
          How to find us
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Look up <span className="text-[var(--accent-fg)]">The Train Station</span> plus one more word.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
          “Train station” by itself is the railroad. This is Coach Jeremy Byrd’s training app —
          workouts, exercise, fitness, weight loss, and programs at{" "}
          <strong className="text-[var(--text)]">thetrainstation.co</strong>.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          Tell people: search <strong className="text-[var(--text)]">The Train Station</strong> and
          any word below. Every one of these is us.
        </p>

        <ul className="mt-8 flex flex-wrap gap-2">
          {WORDS.map((word) => (
            <li key={word}>
              <span className="inline-block rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm">
                The Train Station{" "}
                <span className="font-semibold text-[var(--accent-fg)]">{word}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/join" className="btn-primary px-5 py-2.5 text-sm font-semibold">
            Join
          </Link>
          <Link href="/" className="btn-ghost px-5 py-2.5 text-sm">
            See the home page
          </Link>
        </div>
      </main>
      <LandingSiteFooter />
    </div>
  );
}
