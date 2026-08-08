"use client";

import { useEffect, useState } from "react";
import ComingSoonPrograms from "@/components/ComingSoonPrograms";
import LandingTicketPicker from "@/components/LandingTicketPicker";
import { TOP_LEVEL_PROGRAMS } from "@/lib/programs";

/**
 * Join conversion: pick a program first, then reveal Free / Coach / Business / 1st tickets.
 * Dual fan art stays off — ticket imagery lives on signup for the chosen plan.
 */
export default function JoinProgramThenTickets({
  freeChastiseVideoUrl = null,
  welcomeVideoUrl = null,
  fromTour = false,
}: {
  freeChastiseVideoUrl?: string | null;
  welcomeVideoUrl?: string | null;
  fromTour?: boolean;
}) {
  const [program, setProgram] = useState<string | null>(null);

  useEffect(() => {
    // Deep-link /join#tickets or /join#programs (nav + end of See inside tour)
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash === "#tickets" || hash === "#programs") {
      const id = hash.slice(1);
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, []);

  useEffect(() => {
    if (!program) return;
    document.getElementById("tickets")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [program]);

  const selected = TOP_LEVEL_PROGRAMS.find((p) => p.slug === program);

  return (
    <div>
      {/* Tickets always present for Memberships nav → /join#tickets */}
      <div id="tickets" className="scroll-mt-20">
        <div className="mx-auto max-w-3xl px-6 pb-2 pt-2 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#7c3aed]">
            Memberships
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-[var(--text)] sm:text-3xl">
            Choose your ticket
          </h2>
          {selected ? (
            <p className="mt-1 text-sm text-[var(--accent-fg)]">
              For program: <span className="font-semibold text-[var(--text)]">{selected.name}</span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-[var(--muted)]">
              Free · Coach · Business · 1st Class — pay anytime
            </p>
          )}
        </div>
        <LandingTicketPicker
          freeChastiseVideoUrl={freeChastiseVideoUrl}
          welcomeVideoUrl={welcomeVideoUrl}
        />
      </div>

      <section id="programs" className="scroll-mt-20 px-4 pb-6 sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#7c3aed]">
            Programs
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--text)] sm:text-3xl">
            Pick your program
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--muted)]">
            {fromTour
              ? "Same station you just toured — choose the track you want to train on."
              : "Optional track — ticket payment works with or without a program pick."}
          </p>
        </div>

        <div className="mx-auto mt-6 grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {TOP_LEVEL_PROGRAMS.filter(
            (p) => p.catalogStatus !== "hidden" && p.category === "workout",
          ).map((p) => {
            const active = program === p.slug;
            const soon = p.catalogStatus === "coming_soon";
            return (
              <button
                key={p.slug}
                type="button"
                onClick={() => setProgram(p.slug)}
                className={`rounded-2xl border p-4 text-left transition ${
                  active
                    ? "border-[#7c3aed] bg-[#7c3aed]/15 ring-2 ring-[#7c3aed]/40"
                    : "border-[var(--border)] bg-[var(--bg)]/80 hover:border-[#7c3aed]/50 hover:bg-[#1a1428]"
                }`}
              >
                {soon ? (
                  <span className="mb-1 inline-block rounded-full bg-[#7c3aed]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--accent-fg)]">
                    Soon
                  </span>
                ) : null}
                <p className="text-sm font-semibold text-[var(--text)]">{p.name}</p>
                {p.description ? (
                  <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--muted)]">
                    {p.description}
                  </p>
                ) : null}
                <span
                  className={`mt-3 inline-block text-[10px] font-semibold ${
                    active ? "text-[var(--accent-fg)]" : "text-[#7c3aed]"
                  }`}
                >
                  {active ? "Selected ✓" : "Select →"}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mx-auto mt-4 max-w-lg px-2 pb-6 text-center text-sm text-[var(--muted)]">
          Tickets are above — pay anytime. Program is optional and editable later in Settings.
        </p>
      </section>

      <ComingSoonPrograms compact />
    </div>
  );
}
