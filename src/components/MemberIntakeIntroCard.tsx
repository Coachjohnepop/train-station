"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { COACH_CALENDLY_URL } from "@/lib/brand";
import { GAMIFICATION_POINTS } from "@/lib/gamification-types";
import EmbeddedCalendlyModal from "@/components/EmbeddedCalendlyModal";

export default function MemberIntakeIntroCard() {
  const [calendlyUrl, setCalendlyUrl] = useState(COACH_CALENDLY_URL);
  const [memberEmail, setMemberEmail] = useState<string | undefined>();
  const [memberName, setMemberName] = useState<string | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [booked, setBooked] = useState(false);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    (async () => {
      const [contactRes, sessionRes] = await Promise.all([
        fetch("/api/admin/contact"),
        fetch("/api/auth/session"),
      ]);
      if (contactRes.ok) {
        const contact = await contactRes.json();
        if (contact.calendlyUrl) setCalendlyUrl(contact.calendlyUrl);
      }
      if (sessionRes.ok) {
        const session = await sessionRes.json();
        if (session.signedIn && session.user) {
          setMemberEmail(session.user.email);
          setMemberName(session.user.name);
        }
      }
    })();
  }, []);

  async function handleScheduled() {
    setBooked(true);
    setBooking(true);
    try {
      const res = await fetch("/api/member/intake-scheduled", { method: "POST" });
      const data = await res.json();
      const totalPoints =
        typeof data.totalPoints === "number"
          ? data.totalPoints
          : GAMIFICATION_POINTS.intake_scheduled;
      const pointsEarned =
        typeof data.pointsEarned === "number" && data.pointsEarned > 0
          ? data.pointsEarned
          : data.awarded
            ? GAMIFICATION_POINTS.intake_scheduled
            : 0;

      window.dispatchEvent(
        new CustomEvent("intake-booking-celebrate", {
          detail: { pointsEarned, totalPoints },
        }),
      );
      if (pointsEarned === 0) {
        window.dispatchEvent(
          new CustomEvent("member-score-updated", { detail: { totalPoints } }),
        );
      }
    } finally {
      setBooking(false);
    }
  }

  return (
    <>
      <div className="intake-next-step-card card space-y-3 p-4 sm:p-5">
        <p className="intake-next-step-badge">
          <span aria-hidden>★</span>
          Your next step
        </p>
        <h2 className="intake-next-step-title text-xl font-bold leading-tight sm:text-2xl">
          Book your 15-minute intro with Coach Jeremy
        </h2>
        <p className="text-sm text-[var(--muted)]">
          This unlocks your full program after coach sign-off. While you wait, knock out the warm-ups
          below — checking them off gives your coach a heads-up so you have more time for main lifts.
        </p>

        {booked ? (
          <div className="rounded-lg border border-[var(--success)]/35 bg-[var(--success)]/10 px-3 py-3 text-sm text-[var(--success)]">
            <p className="font-semibold">Intro call booked — you&apos;re on the board.</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Check your email for confirmation and Zoom details. Warm-ups below while you wait.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="intake-book-btn-wrap sm:pb-5">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                disabled={booking}
                className="intake-book-btn w-full text-center sm:w-auto"
              >
                {booking ? "Saving…" : "Book 15-min intro →"}
              </button>
              <span className="intake-guide-pointer" aria-hidden>
                👆
              </span>
            </div>
            <Link href="/member/chat" className="btn-ghost text-center text-sm sm:mb-5">
              Message coach
            </Link>
          </div>
        )}
      </div>

      <EmbeddedCalendlyModal
        open={modalOpen}
        calendlyUrl={calendlyUrl}
        prefill={
          memberEmail || memberName
            ? { email: memberEmail, name: memberName }
            : undefined
        }
        title="Book your 15-min intro"
        onClose={() => setModalOpen(false)}
        onScheduled={() => {
          setModalOpen(false);
          void handleScheduled();
        }}
      />
    </>
  );
}