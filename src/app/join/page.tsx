import Link from "next/link";
import LandingSiteFooter from "@/components/LandingSiteFooter";
import JoinProgramThenTickets from "@/components/JoinProgramThenTickets";
import PricingWithInlineSignup from "@/components/PricingWithInlineSignup";
import { getResolvedLandingVideos } from "@/lib/landing-media-server";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ rec?: string; from?: string }>;
}) {
  const params = await searchParams;
  const recParam = (params.rec || "").toLowerCase();
  const fromTour = (params.from || "").toLowerCase() === "tour";
  const landingVideos = await getResolvedLandingVideos();

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight hover:text-[var(--accent)]">
            The Train Station
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <a href="#programs" className="text-[var(--muted)] transition hover:text-[var(--text)]">
              Programs
            </a>
            <a href="#plans" className="hidden text-[var(--muted)] transition hover:text-[var(--text)] sm:inline">
              Compare
            </a>
            <Link href="/login" className="text-[var(--muted)] transition hover:text-[var(--text)]">
              Sign in
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 pb-4 pt-12 text-center sm:pt-14">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[3px] text-[#7c3aed]">
          {fromTour ? "You saw inside" : "Board the station"}
        </div>
        <h1 className="mb-3 text-4xl font-semibold tracking-[-1.5px] sm:text-5xl sm:tracking-[-1.8px]">
          Pick a program, then your ticket
        </h1>
        <p className="mx-auto max-w-xl text-lg text-[var(--muted)] sm:text-xl">
          Train on the track you want — then choose Free, Coach Class, Business Class, or 1st Class.
        </p>
        {fromTour ? (
          <p className="mx-auto mt-3 max-w-md text-sm font-medium text-[var(--accent-fg)]/90">
            That live session you just saw? Same console after you board.
          </p>
        ) : null}
      </div>

      <JoinProgramThenTickets
        fromTour={fromTour}
        freeChastiseVideoUrl={landingVideos.freeChastiseVideoUrl}
        welcomeVideoUrl={landingVideos.welcomeVideoUrl}
      />

      <div className="mx-auto mb-4 max-w-2xl px-6 text-center">
        <div className="mb-2 inline-block rounded-full bg-[#7c3aed]/10 px-3 py-1 text-xs font-semibold tracking-widest text-[#7c3aed]">
          NOT SURE?
        </div>
        <p className="text-sm text-[var(--muted)]">
          Answer 4 quick questions — we&apos;ll recommend a seat.
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/join/questions"
            className="inline-flex h-10 items-center justify-center rounded-full bg-[#7c3aed] px-5 text-sm font-semibold text-white transition-all hover:bg-[#6d2dd6]"
          >
            Take the 1-minute assessment →
          </Link>
          <a href="#plans" className="text-sm text-[var(--muted)] underline hover:text-[var(--text)]">
            or compare plan details
          </a>
        </div>
      </div>

      <div id="plans" className="mx-auto max-w-6xl scroll-mt-20 px-6 pb-16 pt-4">
        <p className="mb-6 text-center text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
          Plan details
        </p>
        <PricingWithInlineSignup recParam={recParam} />
      </div>

      <div className="border-t border-[var(--border)] bg-[var(--surface)] py-10">
        <div className="mx-auto max-w-xl px-6 text-center">
          <p className="mb-4 text-[var(--muted)]">
            Questions about tickets or need a custom team option?
          </p>
          <a
            href="mailto:jeremy@thetrainstation.co"
            className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--border)] px-8 text-sm font-semibold transition-all hover:scale-[1.05] hover:bg-white/5"
          >
            Talk to the team
          </a>
        </div>
      </div>
      <LandingSiteFooter />
    </div>
  );
}
