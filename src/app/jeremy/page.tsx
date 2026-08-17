import type { Metadata } from "next";
import Link from "next/link";
import LandingNav from "@/components/LandingNav";
import LandingSiteFooter from "@/components/LandingSiteFooter";
import { JOIN_WEEK_HREF } from "@/lib/landing-return-visit";
import { COACH_CALENDLY_URL } from "@/lib/brand";
import { siteOrigin } from "@/lib/site-seo-server";

export const metadata: Metadata = {
  title: "Coach Jeremy Byrd — The Train Station fitness",
  description:
    "Jeremy Byrd, CSCS, runs The Train Station: online workouts, live Zoom class, and accountability. Search The Train Station fitness or Jeremy Byrd — that’s this app, not the railroad.",
  alternates: { canonical: "/jeremy" },
  openGraph: {
    title: "Coach Jeremy Byrd — The Train Station fitness",
    description:
      "CSCS coach. Live class. Written programs. Search The Train Station fitness to find him.",
    url: "/jeremy",
    images: [{ url: "/images/programs/speaking.jpg", alt: "Coach Jeremy Byrd speaking" }],
  },
};

export default function JeremyByrdPage() {
  const origin = siteOrigin();
  const personLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${origin}/#jeremy`,
    name: "Jeremy Byrd",
    alternateName: ["Coach Jeremy", "Jeremy Byrd CSCS", "Coach Byrd"],
    jobTitle: "Strength and conditioning coach",
    description:
      "Jeremy Byrd, CSCS, is the coach behind The Train Station fitness app — online workouts, live class, and member accountability.",
    url: `${origin}/jeremy`,
    image: `${origin}/images/programs/speaking.jpg`,
    worksFor: { "@id": `${origin}/#org` },
    knowsAbout: [
      "strength training",
      "online coaching",
      "weight loss",
      "live fitness class",
      "accountability coaching",
    ],
  };
  const pageLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "Coach Jeremy Byrd — The Train Station fitness",
    url: `${origin}/jeremy`,
    mainEntity: { "@id": `${origin}/#jeremy` },
    isPartOf: { "@id": `${origin}/#website` },
  };

  return (
    <div className="app-shell-bg min-h-screen text-[var(--text)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageLd) }} />
      <LandingNav />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.35em] text-[var(--muted)]">
          The coach
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Jeremy Byrd builds The Train Station fitness.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-[var(--muted)]">
          Not a railroad. Not a franchise gym. One coach — CSCS — writing the day’s work and
          showing up on Zoom when class is live.
        </p>

        <figure className="mt-8 overflow-hidden rounded-2xl border border-[var(--border)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/programs/speaking.jpg"
            alt="Coach Jeremy Byrd speaking to a room — The Train Station fitness"
            className="aspect-[16/10] w-full object-cover object-center"
          />
          <figcaption className="bg-[var(--surface)] px-4 py-2 text-xs text-[var(--muted)]">
            Jeremy Byrd · The Train Station
          </figcaption>
        </figure>

        <section className="mt-10 space-y-4 text-base leading-relaxed text-[var(--muted)]">
          <p>
            <strong className="text-[var(--text)]">The Train Station</strong> is Jeremy’s training
            app. Members open <strong className="text-[var(--text)]">Today</strong>, lift what he
            programmed, rest 45 seconds between sets, and check the boxes so he can see the work.
          </p>
          <p>
            He coaches Adult strength, athletes, military prep, and parents who only have a little
            time. Live class is on Zoom from his floor — same workout the phone already shows.
          </p>
          <blockquote className="border-l-2 border-[var(--accent)] pl-4 text-[var(--text)]">
            Search <strong>The Train Station fitness</strong>. If someone only types “train
            station,” they will get the railroad. Add fitness — or workout, or Jeremy Byrd — and
            they land here.
          </blockquote>
          <p>
            Accountability is the product. Email is not enough. Jeremy wants to know when someone
            signs up and when they miss a day — so the member does not disappear into a forgotten
            login.
          </p>
        </section>

        <section className="mt-10 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            How people find him
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-[var(--text)]">
            <li>The Train Station fitness</li>
            <li>The Train Station workout</li>
            <li>Jeremy Byrd coach</li>
            <li>
              Direct:{" "}
              <span className="font-semibold text-[var(--accent-fg)]">thetrainstation.co</span>
            </li>
          </ul>
          <Link href="/find" className="mt-4 inline-block text-sm font-semibold text-[var(--accent-fg)]">
            Full find-us list →
          </Link>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href={JOIN_WEEK_HREF} className="btn-primary px-5 py-2.5 text-sm font-semibold">
            Start membership — 7 days
          </Link>
          <Link href="/?tour=1" className="btn-ghost px-5 py-2.5 text-sm">
            Free Tour
          </Link>
          <a
            href={COACH_CALENDLY_URL}
            className="btn-ghost px-5 py-2.5 text-sm"
            target="_blank"
            rel="noreferrer"
          >
            Book 15 minutes
          </a>
        </div>
      </main>
      <LandingSiteFooter />
    </div>
  );
}
