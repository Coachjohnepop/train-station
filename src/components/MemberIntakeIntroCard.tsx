"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { COACH_CALENDLY_URL } from "@/lib/brand";
import { GAMIFICATION_POINTS } from "@/lib/gamification-types";
import { dispatchMemberScoreCelebrate } from "@/lib/member-score-celebrate";
import EmbeddedCalendlyModal from "@/components/EmbeddedCalendlyModal";
import { NextStepButton, NextStepLink } from "@/components/NextStepButton";
import { isGuestStubEmail, isPlaceholderGuestUsername } from "@/lib/byow-username";

type IntakeStatus = {
  introBookedAt: string | null;
  coachMeetingRequestedAt: string | null;
  coachMeetingRequestNote: string | null;
  rescheduleUrl?: string | null;
};

export default function MemberIntakeIntroCard({
  initialStatus = null,
  followUpOnly = false,
  onBooked,
  compact = false,
  pester = false,
}: {
  initialStatus?: IntakeStatus | null;
  /** When true, only show the card for a coach-requested follow-up (post sign-off). */
  followUpOnly?: boolean;
  onBooked?: () => void;
  compact?: boolean;
  /** Stronger “every seat books this” copy. */
  pester?: boolean;
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
      rescheduleUrl: null,
    },
  );
  const [booking, setBooking] = useState(false);
  const [open, setOpen] = useState(false);
  const [bookEmail, setBookEmail] = useState("");
  const [emailError, setEmailError] = useState("");

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
          const email = session.user.email as string | undefined;
          const name = session.user.name as string | undefined;
          if (email && !isGuestStubEmail(email)) setMemberEmail(email);
          if (name && !isPlaceholderGuestUsername(name)) setMemberName(name);
        }
      }
      if (statusRes?.ok) {
        const data = await statusRes.json();
        setStatus({
          introBookedAt: data.introBookedAt ?? null,
          coachMeetingRequestedAt: data.coachMeetingRequestedAt ?? null,
          coachMeetingRequestNote: data.coachMeetingRequestNote ?? null,
          rescheduleUrl: data.rescheduleUrl ?? null,
        });
      }
    })();
  }, [initialStatus]);

  async function handleScheduled(details?: {
    scheduledAt?: string | null;
    eventUri?: string | null;
    inviteeUri?: string | null;
    rescheduleUrl?: string | null;
    cancelUrl?: string | null;
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
          calendlyInviteeUri: details?.inviteeUri || null,
          calendlyRescheduleUrl: details?.rescheduleUrl || null,
          calendlyCancelUrl: details?.cancelUrl || null,
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
        rescheduleUrl: data.rescheduleUrl || details?.rescheduleUrl || prev.rescheduleUrl || null,
      }));

      if (!bookingFollowUp) {
        dispatchMemberScoreCelebrate({
          pointsEarned,
          totalPoints,
          label: "Intro booked",
        });
      }
      onBooked?.();
    } finally {
      setBooking(false);
    }
  }

  const needsRealEmail = !memberEmail;
  const showIntroBook = !introBooked;

  async function openBooking() {
    setEmailError("");
    if (needsRealEmail) {
      const email = bookEmail.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || isGuestStubEmail(email)) {
        setEmailError("Use a real email to book Jeremy.");
        return;
      }
      const res = await fetch("/api/byow/claim-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEmailError(data.error || "Could not save email.");
        return;
      }
      setMemberEmail(data.email || email);
    }
    setModalOpen(true);
  }

  const calendlyEmail = memberEmail || (bookEmail.includes("@") ? bookEmail.trim() : undefined);
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
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-left"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span>
            <p className={`intake-next-step-badge ${introBooked ? "intake-next-step-badge--booked" : ""}`}>
              <span aria-hidden>{introBooked ? "✓" : "★"}</span>
              {introBooked
                ? meetingRequested
                  ? "Follow-up requested"
                  : "Intro scheduled"
                : pester
                  ? "Required — every seat"
                  : "Your next step"}
            </p>
            <h2
              className={`intake-next-step-title mt-1 font-bold leading-tight ${
                compact ? "text-lg" : "text-xl sm:text-2xl"
              } ${introBooked ? "intake-next-step-title--booked" : ""}`}
            >
              {meetingRequested && introBooked
                ? "Coach requested another check-in"
                : "Meet Jeremy — book your 15-minute intro"}
            </h2>
          </span>
          <span aria-hidden className={`shrink-0 text-sm text-[var(--muted)] transition ${open ? "rotate-180" : ""}`}>
            ▾
          </span>
        </button>
        {!open ? null : (
          <>
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
              Working out is personal. Train today if you want — book this intro before or after.
              Use a real email so Jeremy can reach you.
            </>
          )}
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          {introBooked && status.rescheduleUrl ? (
            <NextStepLink href={status.rescheduleUrl}>Change appointment</NextStepLink>
          ) : introBooked ? (
            <button
              type="button"
              disabled
              className="intake-book-btn intake-book-btn--completed w-full sm:w-auto"
              aria-label="15-minute intro booked"
            >
              ✓ Book 15-min intro — Completed
            </button>
          ) : null}

          {showIntroBook && (
            <div className="flex w-full flex-col gap-2 sm:max-w-md">
              {needsRealEmail ? (
                <>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="Your email"
                    value={bookEmail}
                    onChange={(e) => setBookEmail(e.target.value)}
                    className="h-12 w-full rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm"
                  />
                  {emailError ? <p className="text-sm text-red-300">{emailError}</p> : null}
                </>
              ) : null}
              <NextStepButton
                onClick={() => void openBooking()}
                disabled={booking}
                data-analytics-action="book-jeremy"
              >
                {booking ? "Saving…" : "Book 15 min with Jeremy"}
              </NextStepButton>
            </div>
          )}

          {showFollowUpBook && (
            <NextStepButton onClick={() => setModalOpen(true)} disabled={booking}>
              {booking ? "Saving…" : "Continue — book follow-up"}
            </NextStepButton>
          )}

          <Link href="/member/chat" className="btn-ghost text-center text-sm sm:mb-5">
            Message coach
          </Link>
        </div>
          </>
        )}
      </div>

      <EmbeddedCalendlyModal
        open={modalOpen}
        calendlyUrl={calendlyUrl}
        prefill={
          calendlyEmail || memberName
            ? { email: calendlyEmail, name: memberName }
            : undefined
        }
        title={modalTitle}
        onClose={() => setModalOpen(false)}
        onScheduled={(details) => {
          setModalOpen(false);
          void handleScheduled({
            scheduledAt: details.scheduledAt,
            eventUri: details.eventUri,
            inviteeUri: details.inviteeUri,
          });
        }}
      />
    </>
  );
}