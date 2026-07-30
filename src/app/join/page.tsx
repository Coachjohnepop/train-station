import Link from "next/link";
import ComingSoonPrograms from "@/components/ComingSoonPrograms";
import LandingSiteFooter from "@/components/LandingSiteFooter";
import LandingTicketPicker from "@/components/LandingTicketPicker";
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
    <div className="min-h-screen bg-[#0a0612] text-[#f2ecf9]">
      <div className="border-b border-[#3d2660] bg-[#140a22]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight hover:text-[var(--accent)]">
            The Train Station
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <a href="#tickets" className="text-[#9d8ab8] transition hover:text-white">
              Tickets
            </a>
            <a href="#plans" className="hidden text-[#9d8ab8] transition hover:text-white sm:inline">
              Compare
            </a>
            <Link href="/login" className="text-[#9d8ab8] transition hover:text-white">
              Sign in
            </Link>
          </div>
        </div>
      </div>

      {/* Hero — choose ticket is the conversion ask after “See inside”. */}
      <div className="mx-auto max-w-3xl px-6 pb-6 pt-12 text-center sm:pt-16">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[3px] text-[#7c3aed]">
          {fromTour ? "You saw inside" : "Board the station"}
        </div>
        <h1 className="mb-4 text-4xl font-semibold tracking-[-1.5px] sm:text-5xl sm:tracking-[-1.8px]">
          Choose your ticket
        </h1>
        <p className="mx-auto max-w-xl text-lg text-[#9d8ab8] sm:text-xl">
          Free Explorer, Coach Class, Business Class, or First Class — pick the seat that fits how
          hard you want to train.
        </p>
        {fromTour ? (
          <p className="mx-auto mt-3 max-w-md text-sm font-medium text-[#c4b5fd]/90">
            That live session you just saw? Same console members use every day.
          </p>
        ) : null}
      </div>

      {/* Ticket theater — Free / Coach / Business / First */}
      <LandingTicketPicker
        freeChastiseVideoUrl={landingVideos.freeChastiseVideoUrl}
        welcomeVideoUrl={landingVideos.welcomeVideoUrl}
      />

      {/* Optional: not sure which plan */}
      <div className="mx-auto mb-4 max-w-2xl px-6 text-center">
        <div className="mb-2 inline-block rounded-full bg-[#7c3aed]/10 px-3 py-1 text-xs font-semibold tracking-widest text-[#7c3aed]">
          NOT SURE WHICH TICKET?
        </div>
        <p className="text-sm text-[#9d8ab8]">
          Answer 4 quick questions about training frequency, structure, eating, and goals — we&apos;ll
          recommend a seat.
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/join/questions"
            className="inline-flex h-10 items-center justify-center rounded-full bg-[#7c3aed] px-5 text-sm font-semibold text-white transition-all hover:bg-[#6d2dd6]"
          >
            Take the 1-minute assessment →
          </Link>
          <a href="#plans" className="text-sm text-[#9d8ab8] underline hover:text-white">
            or compare plan details
          </a>
        </div>
      </div>

      {/* Detail cards under tickets */}
      <div id="plans" className="mx-auto max-w-6xl scroll-mt-20 px-6 pb-16 pt-4">
        <p className="mb-6 text-center text-xs font-bold uppercase tracking-[0.2em] text-[#9d8ab8]">
          Plan details
        </p>
        <PricingWithInlineSignup recParam={recParam} />
      </div>

      <ComingSoonPrograms compact />

      <div className="border-t border-[#3d2660] bg-[#140a22] py-10">
        <div className="mx-auto max-w-xl px-6 text-center">
          <p className="mb-4 text-[#9d8ab8]">
            Questions about tickets or need a custom team option?
          </p>
          <a
            href="mailto:jeremy@thetrainstation.co"
            className="inline-flex h-11 items-center justify-center rounded-full border border-[#3d2660] px-8 text-sm font-semibold transition-all hover:scale-[1.05] hover:bg-white/5"
          >
            Talk to the team
          </a>
        </div>
      </div>
      <LandingSiteFooter />
    </div>
  );
}
