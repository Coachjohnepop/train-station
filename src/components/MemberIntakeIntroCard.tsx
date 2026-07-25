"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { COACH_CALENDLY_URL } from "@/lib/brand";
import { GAMIFICATION_POINTS } from "@/lib/gamification-types";
import { dispatchMemberScoreCelebrate } from "@/lib/member-score-celebrate";
import EmbeddedCalendlyModal from "@/components/EmbeddedCalendlyModal";

type IntakeStatus = {
  introBookedAt: string | null;
  coachMeetingRequestedAt: string | null;
  coachMeetingRequestNote: string | null;
};

export default function MemberIntakeIntroCard({
  initialStatus = null,
  followUpOnly = false,
}: {
  initialStatus?: IntakeStatus | null;
  /** When true, only show the card for a coach-requested follow-up (post sign-off). */
  followUpOnly?: boolean;
}) {
  const [calendlyUrl, setCalendlyUrl] = useState(COACH_CALENDLY_URL);
  const [memberEmail, setMemberEmail] = useState<string | undefined>();
  const [memberName, setMemberName] = useState<string | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [status, setStatus] = useState<IntakeStatus>(
    initialStatus ?? {
      introBookedAt: null,
      coachMeetingRequestedAt: null,
      coachMeetingRequestNote: null,
    },
  );
  const [booking, setBooking] = useState(false);

  const introBooked = Boolean(status.introBookedAt);
  const meetingRequested = Boolean(status.coachMeetingRequestedAt);
  const bookingFollowUp = introBooked && meetingRequested;

  useEffect(() => {
    (async () => {
      const [contactRes, sessionRes, statusRes] = await Promise.all([
        fetch("/api/bookings/contact", { cache: "no-store" }),
        fetch("/api/auth/session"),
        initialStatus ? Promise.resolve(null) : fetch("/api/member/intake-status", { cache: "no-store" }),
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
      if (statusRes?.ok) {
        const data = await statusRes.json();
        setStatus({
          introBookedAt: data.introBookedAt ?? null,
          coachMeetingRequestedAt: data.coachMeetingRequestedAt ?? null,
          coachMeetingRequestNote: data.coachMeetingRequestNote ?? null,
        });
      }
    })();
  }, [initialStatus]);

  async function handleScheduled(details?: {
    scheduledAt?: string | null;
    eventUri?: string | null;
  }) {
    setBooking(true);
    try {
      const res = await fetch("/api/member/intake-scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: details?.scheduledAt || null,
          bookingSource: "calendly",
          calendlyEventUri: details?.eventUri || null,
        }),
      });
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

      setStatus((prev) => ({
        introBookedAt: data.introBookedAt || prev.introBookedAt || new Date().toISOString(),
        coachMeetingRequestedAt: null,
        coachMeetingRequestNote: null,
      }));

      if (!bookingFollowUp) {
        dispatchMemberScoreCelebrate({
          pointsEarned,
          totalPoints,
          label: "Intro booked",
        });
      }
    } finally {
      setBooking(false);
    }
  }

  const showIntroBook = !introBooked;
  const showFollowUpBook = meetingRequested;
  const modalTitle = bookingFollowUp ? "Book your follow-up call" : "Book your 15-min intro";

  if (followUpOnly && !meetingRequested) return null;

  return (
    <>
      <div
        className={`intake-next-step-card card space-y-3 p-4 sm:p-5 ${
          introBooked ? "intake-next-step-card--booked" : ""
        }`}
      >
        <p className={`intake-next-step-badge ${introBooked ? "intake-next-step-badge--booked" : ""}`}>
          <span aria-hidden>{introBooked ? "✓" : "★"}</span>
          {introBooked ? (meetingRequested ? "Follow-up requested" : "Intro scheduled") : "Your next step"}
        </p>
        <h2
          className={`intake-next-step-title text-xl font-bold leading-tight sm:text-2xl ${
            introBooked ? "intake-next-step-title--booked" : ""
          }`}
        >
          {meetingRequested && introBooked
            ? "Coach requested another check-in"
            : "Book your 15-minute intro with Coach Jeremy"}
        </h2>
        <p className="text-sm text-[var(--muted)]">
          {meetingRequested && introBooked ? (
            <>
              {status.coachMeetingRequestNote || "Your coach asked to schedule a follow-up."} Book a time
              below when you&apos;re ready.
            </>
          ) : introBooked ? (
            <>You&apos;re on the board — warm up below while you wait for your call.</>
          ) : (
            <>
              This unlocks your full program after coach sign-off. While you wait, knock out the warm-ups
              below — checking them off gives your coach a heads-up so you have more time for main lifts.
            </>
          )}
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          {introBooked && (
            <button
              type="button"
              disabled
              className="intake-book-btn intake-book-btn--completed w-full sm:w-auto"
              aria-label="15-minute intro booked"
            >
              ✓ Book 15-min intro — Completed
            </button>
          )}

          {showIntroBook && (
            <div className="intake-book-btn-wrap">
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
          )}

          {showFollowUpBook && (
            <div className={introBooked ? "intake-book-btn-wrap" : "intake-book-btn-wrap"}>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                disabled={booking}
                className="intake-book-btn w-full text-center sm:w-auto"
              >
                {booking ? "Saving…" : "Book follow-up call →"}
              </button>
              <span className="intake-guide-pointer" aria-hidden>
                👆
              </span>
            </div>
          )}

          <Link href="/member/chat" className="btn-ghost text-center text-sm sm:mb-5">
            Message coach
          </Link>
        </div>
      </div>

      <EmbeddedCalendlyModal
        open={modalOpen}
        calendlyUrl={calendlyUrl}
        prefill={
          memberEmail || memberName ? { email: memberEmail, name: memberName } : undefined
        }
        title={modalTitle}
        onClose={() => setModalOpen(false)}
        onScheduled={(details) => {
          setModalOpen(false);
          void handleScheduled({
            scheduledAt: details.scheduledAt,
            eventUri: details.eventUri,
          });
        }}
      />
    </>
  );
}