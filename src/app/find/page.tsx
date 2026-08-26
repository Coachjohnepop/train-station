import type { Metadata } from "next";
import Link from "next/link";
import LandingNav from "@/components/LandingNav";
import LandingSiteFooter from "@/components/LandingSiteFooter";
import FindPhraseCopy from "@/components/FindPhraseCopy";
import {
  SEARCH_THIRD_WORD_ALIASES,
  SEARCH_THIRD_WORDS,
} from "@/lib/search-third-words";
import { JOIN_TICKETS_HREF } from "@/lib/landing-return-visit";
import { siteOrigin } from "@/lib/site-seo-server";

export const metadata: Metadata = {
  title: "Find The Train Station fitness",
  description:
    "Search The Train Station fitness — not the railroad. This is Coach Jeremy Byrd’s workout app at thetrainstation.co. Also works with workout, exercise, coaching, or Jeremy Byrd.",
  alternates: { canonical: "/find" },
  openGraph: {
    title: "Find The Train Station fitness — Coach Jeremy Byrd",
    description:
      "“Train station” is the railroad. “The Train Station fitness” is Jeremy Byrd’s training app.",
    url: "/find",
  },
};

const WORDS = [...SEARCH_THIRD_WORDS, ...SEARCH_THIRD_WORD_ALIASES];

const FAQS = [
  {
    q: "Why doesn’t “train station” find this site?",
    a: "Those two words are a railroad and maps query. Apple and Google show Amtrak, metro stops, and “near me.” This app is The Train Station fitness — Coach Jeremy Byrd’s workouts at thetrainstation.co.",
  },
  {
    q: "What should I search?",
    a: "Type The Train Station plus one more word: fitness, workout, exercise, coaching, Jeremy Byrd, weight loss, or program. Every one of those is this site.",
  },
  {
    q: "Who is Jeremy Byrd?",
    a: "Coach Jeremy Byrd, CSCS. He runs The Train Station — live class, written programs, and day-to-day accountability. Not a gym chain and not a commuter stop.",
  },
  {
    q: "Is this an app or a gym?",
    a: "It’s a training app. Members open Today on their phone, check off sets, rest 45 seconds, and join Jeremy on Zoom when class is live. Free is a real seat; Coach Class is when you want Jeremy.",
  },
];

export default function FindTheTrainStationPage() {
  const origin = siteOrigin();
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
  const webPageLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Find The Train Station fitness",
    url: `${origin}/find`,
    description:
      "Search The Train Station fitness — not the railroad. Coach Jeremy Byrd’s workout app at thetrainstation.co.",
    isPartOf: { "@id": `${origin}/#website` },
    about: { "@id": `${origin}/#jeremy` },
  };

  return (
    <div className="app-shell-bg min-h-screen text-[var(--text)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <LandingNav />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.35em] text-[var(--muted)]">
          How to find us
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Search <span className="text-[var(--accent-fg)]">The Train Station fitness</span>
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">
          “Train station” by itself is the railroad. This is Coach Jeremy Byrd’s training app —
          workouts, live class, and accountability at{" "}
          <strong className="text-[var(--text)]">thetrainstation.co</strong>.
        </p>
        <p className="mt-3 text-base leading-relaxed text-[var(--text)]">
          Tell a friend: search <strong>The Train Station fitness</strong>. That search is us.
        </p>

        <div className="mt-6">
          <FindPhraseCopy />
        </div>

        <h2 className="mt-10 text-lg font-semibold">Any of these third words works</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Same site. Same coach. The extra word keeps you off the Amtrak results.
          The spoken URL is{" "}
          <a href="/fitness" className="font-semibold text-[var(--accent-fg)] underline-offset-2 hover:underline">
            thetrainstation.co/fitness
          </a>
          — that lands on the same three doors as home.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {WORDS.map((word) => (
            <li key={word}>
              <span className="inline-block rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm">
                The Train Station{" "}
                <span className="font-semibold text-[var(--accent-fg)]">{word}</span>
              </span>
            </li>
          ))}
        </ul>

        <section className="mt-12 space-y-6">
          <h2 className="text-lg font-semibold">Questions people actually ask</h2>
          {FAQS.map((item) => (
            <div key={item.q}>
              <h3 className="text-sm font-semibold text-[var(--text)]">{item.q}</h3>
              <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{item.a}</p>
            </div>
          ))}
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/?tour=1" className="btn-primary px-5 py-2.5 text-sm font-semibold">
            Free Tour
          </Link>
          <Link href={JOIN_TICKETS_HREF} className="btn-ghost px-5 py-2.5 text-sm">
            Start membership
          </Link>
          <Link href="/jeremy" className="btn-ghost px-5 py-2.5 text-sm">
            Meet Jeremy
          </Link>
        </div>
      </main>
      <LandingSiteFooter />
    </div>
  );
}
