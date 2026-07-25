import type { Metadata } from "next";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import PoweredByLeadForm from "@/components/PoweredByLeadForm";
import TrainStationBrand from "@/components/TrainStationBrand";

export const metadata: Metadata = {
  title: `Powered by Lemonvoice · ${BRAND_NAME}`,
  description:
    "The platform behind The Train Station — member Today, programs, live class, Messages, payments — built with a real coach on the floor. License the stack for your training business.",
};

const LEMONVOICE = "https://www.lemonvoice.com";
const LEMONVOICE_CAL = "https://calendly.com/john-lemonvoice/30min";

const MODULES = [
  {
    title: "Member Today",
    body: "Day wheel, program work, Quick maintain, Day Complete stamp — one hub so members know exactly what to do.",
  },
  {
    title: "Programs & templates",
    body: "Calendar builder, freeform categories, paste-as-clone packs, gym/home tracks — coach content that survives redeploys in Postgres.",
  },
  {
    title: "Live class & coach floor",
    body: "Zoom Connect, Join Live when the host is actually up, set checkoffs, rest timers, and weight logging that syncs coach ↔ member.",
  },
  {
    title: "Messages & alerts",
    body: "In-app coach–member threads, system notes on workout log, email + web push with durable delivery history in the database.",
  },
  {
    title: "Memberships & money",
    body: "Ticket tiers, Stripe checkout, Venmo backup, tips, upgrades/downgrades — rails a real gym can collect on.",
  },
  {
    title: "Gamification & access",
    body: "Points, leaderboard, free-pool / earn paths, staff grants — engagement without losing the paid product story.",
  },
] as const;

export default function PoweredByPage() {
  return (
    <div className="min-h-screen app-shell-bg text-[var(--text)]">
      <header className="border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 transition hover:opacity-90">
            <TrainStationBrand variant="icon" />
            <span className="text-sm font-semibold tracking-tight">{BRAND_NAME}</span>
          </Link>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            Powered by{" "}
            <a
              href={LEMONVOICE}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline"
            >
              Lemonvoice.com
            </a>
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
          The platform behind this training hub
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
          Run your coaching business on this stack
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[var(--muted)] sm:text-lg">
          Everything powering <strong className="text-[var(--text)]">{BRAND_NAME}</strong> —
          member experience, coach back office, live class, Messages, and payments — was built
          beside a real coach and real members. Not a coffee shop story. A{" "}
          <strong className="text-[var(--text)]">training-floor</strong> story.
        </p>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Built and maintained by{" "}
          <a
            href={LEMONVOICE}
            className="font-semibold text-[var(--accent)] hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Lemonvoice
          </a>{" "}
          — custom apps around your revenue workflows.
        </p>

        <section className="mt-10 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
          <h2 className="text-lg font-bold tracking-tight">Built on the floor, not in a boardroom.</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            {BRAND_NAME} started as Coach Jeremy’s need for a system that actually fits how
            training businesses run: program days that change, members who need “what do I do
            today?”, live classes that shouldn’t lie about “Join”, and money that can clear on
            card <em>or</em> Venmo without a second set of books.
          </p>

          {/* Aggressive build-cost band — git: 43 active days · peak full-intensity soaks · $250/hr */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { v: "400+", k: "documented build-hours" },
              { v: "43", k: "active build days" },
              { v: "$100K+", k: "to rebuild at $250/hr" },
            ].map((stat) => (
              <div
                key={stat.k}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-4 text-center"
              >
                <p className="text-3xl font-extrabold tracking-tight text-[var(--accent)] sm:text-4xl">
                  {stat.v}
                </p>
                <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                  {stat.k}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-[var(--muted)]">
            From first commit (Jun 2026) through live coaching soaks — full-intensity days, not
            calendar fluff. License it and skip the rebuild.
          </p>

          <p className="mt-5 text-sm leading-relaxed text-[var(--muted)]">
            We shipped and soaked features in production — Quick maintain for Business+, Day
            Complete when the day is done, green hold timers into rest, cybertruck rest audio,
            coach floor weight next to sets, YouTube demos, coach notify on workout log, durable
            Postgres for members, chat, live sessions, and notification history. Every piece had
            to earn its place under a live coach and real sessions — not a slide deck.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            License the platform thinking (and the build muscle behind it) for{" "}
            <strong className="text-[var(--text)]">your</strong> gym, private practice, or multi-coach
            studio — and skip rebuilding the same rails from zero.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { k: "Live product", v: "thetrainstation.co" },
              { k: "Domain", v: "Coaching · programs · live class" },
              { k: "Builder", v: "Lemonvoice.com" },
            ].map((stat) => (
              <div
                key={stat.k}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 text-center"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  {stat.k}
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--text)]">{stat.v}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-bold tracking-tight">What this platform already does</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Pick modules that matter to you in the form below — most partners start with a few
            and grow.
          </p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {MODULES.map((m) => (
              <li
                key={m.title}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <h3 className="font-semibold text-[var(--text)]">{m.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{m.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12" id="demo">
          <h2 className="text-xl font-bold tracking-tight">Tell us where to reach you</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Request a demo &amp; pricing for a Train Station–style platform for your coaching
            business. We’ll follow up from Lemonvoice.
          </p>
          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
            <PoweredByLeadForm />
          </div>
          <p className="mt-4 text-center text-sm text-[var(--muted)]">
            Prefer a call?{" "}
            <a
              href={LEMONVOICE_CAL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[var(--accent)] hover:underline"
            >
              Book with Lemonvoice
            </a>
          </p>
        </section>
      </main>

      <footer className="border-t border-[var(--border)] py-8 text-center text-xs text-[var(--muted)]">
        <p>
          {BRAND_NAME} is{" "}
          <span className="font-semibold text-[var(--text)]">powered by Lemonvoice.com</span>
        </p>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <Link href="/" className="hover:text-[var(--accent)]">
            Home
          </Link>
          <span aria-hidden>·</span>
          <Link href="/join" className="hover:text-[var(--accent)]">
            Memberships
          </Link>
          <span aria-hidden>·</span>
          <a
            href={LEMONVOICE}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--accent)]"
          >
            Lemonvoice.com
          </a>
        </p>
      </footer>
    </div>
  );
}
