"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { COACH_CALENDLY_URL } from "@/lib/brand";
import EmbeddedCalendlyModal from "@/components/EmbeddedCalendlyModal";
import {
  formatSlotDateLabel,
  formatSlotTimeRange,
  slotLocalDateKey,
} from "@/lib/booking-slot-format";
import { dispatchMemberScoreCelebrate } from "@/lib/member-score-celebrate";
import { NextStepLink } from "@/components/NextStepButton";
import PhoneInput from "@/components/PhoneInput";
import { formatPhoneDisplay } from "@/lib/sms-phone";

type Slot = { start: string; end: string; label?: string };

export default function BookClient() {
  const searchParams = useSearchParams();
  const purpose = searchParams.get("purpose") || "";
  const isSpeaking = purpose === "speaking";
  const [contact, setContact] = useState<{ email: string; phone?: string; calendlyUrl?: string } | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [memberEmail, setMemberEmail] = useState("demo@thetrainstation.co");
  const [memberPhone, setMemberPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [calendlyModalOpen, setCalendlyModalOpen] = useState(false);
  const [calendlyBooked, setCalendlyBooked] = useState(false);
  const [rescheduleUrl, setRescheduleUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Members must NOT call /api/admin/contact (staff-only) — that hung the page.
        const [cRes, sRes, sessionRes, intakeRes] = await Promise.all([
          fetch("/api/bookings/contact", { cache: "no-store" }),
          fetch("/api/bookings?slots=true", { cache: "no-store" }),
          fetch("/api/auth/session", { cache: "no-store" }),
          fetch("/api/member/intake-status", { cache: "no-store" }),
        ]);
        if (cancelled) return;

        if (cRes.ok) {
          const c = await cRes.json();
          setContact({
            email: c.email || "jeremy@thetrainstation.co",
            phone: c.phone || undefined,
            calendlyUrl: c.calendlyUrl || COACH_CALENDLY_URL,
          });
        } else {
          // Always unblock UI with brand Calendly fallback
          setContact({
            email: "jeremy@thetrainstation.co",
            calendlyUrl: COACH_CALENDLY_URL,
          });
        }

        if (sessionRes.ok) {
          const session = await sessionRes.json();
          if (session.signedIn && session.user?.email) {
            setMemberEmail(session.user.email);
          }
        }
        if (intakeRes.ok) {
          const intake = await intakeRes.json();
          if (typeof intake.rescheduleUrl === "string" && intake.rescheduleUrl.trim()) {
            setRescheduleUrl(intake.rescheduleUrl.trim());
          }
        }
        if (sRes.ok) {
          const raw = await sRes.json();
          setSlots(
            (raw as Slot[]).map((s) => ({
              start: typeof s.start === "string" ? s.start : new Date(s.start).toISOString(),
              end: typeof s.end === "string" ? s.end : new Date(s.end).toISOString(),
            })),
          );
        }
      } catch {
        if (!cancelled) {
          setContact({
            email: "jeremy@thetrainstation.co",
            calendlyUrl: COACH_CALENDLY_URL,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dates = useMemo(
    () => Array.from(new Set(slots.map((s) => slotLocalDateKey(s.start)))).sort(),
    [slots],
  );

  const slotsForDate = selectedDate
    ? slots.filter((s) => slotLocalDateKey(s.start) === selectedDate)
    : [];

  async function book() {
    if (!selectedSlot || !memberEmail) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberEmail,
          memberPhone: memberPhone || undefined,
          scheduledAt: selectedSlot.start,
        }),
      });
      if (!res.ok) throw new Error("Failed to book");
      setResult(
        "Request received! Coach Jeremy will confirm by email or text and send your Zoom link before the call.",
      );
      setSelectedSlot(null);
    } catch (e: unknown) {
      setResult(e instanceof Error ? e.message : "Could not submit booking. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!contact) {
    return <p className="mt-6 text-center text-[var(--muted)]">Loading booking info…</p>;
  }

  const calendly = contact.calendlyUrl || COACH_CALENDLY_URL;

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/member" className="text-xs text-accent hover:underline">
        ← Back to dashboard
      </Link>

      {rescheduleUrl ? (
        <div className="mt-4">
          <NextStepLink href={rescheduleUrl}>Change appointment</NextStepLink>
          <p className="mt-2 text-center text-xs text-[var(--muted)]">
            Opens Calendly so you can pick a new time (including earlier slots Jeremy just opened).
          </p>
        </div>
      ) : null}

      <h1 className="mt-3 text-2xl font-bold">
        {isSpeaking ? "Book your speaking scope call" : "Book your onboarding call"}
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {isSpeaking ? (
          <>
            15-minute Zoom with Coach Jeremy to scope your speaking engagement.{" "}
            <strong className="text-[var(--foreground)]">Book on Calendly</strong> — same open times
            new members use.
          </>
        ) : (
          <>
            15-minute intro with Coach Jeremy on Zoom.{" "}
            <strong className="text-[var(--foreground)]">Book on Calendly</strong> — it shows his real
            open times (not our backup list below).
          </>
        )}
      </p>
      {isSpeaking ? (
        <p className="mt-2 rounded-lg border border-accent/25 bg-accent/10 px-3 py-2 text-xs text-[var(--muted)]">
          Your intake is saved. On the call, Jeremy will confirm fit, fee, and next steps.
        </p>
      ) : null}

      <div className="mt-6 card space-y-3">
        <h2 className="font-semibold">
          {isSpeaking ? "Book your 15-minute scope call" : "Book your intro call (recommended)"}
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Jeremy&apos;s live calendar opens right here. You&apos;ll get a confirmation email with your Zoom link.
        </p>
        {calendlyBooked ? (
          <p className="rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/10 px-3 py-2 text-sm text-[var(--success)]">
            Session booked — check your email for confirmation and Zoom details.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setCalendlyModalOpen(true)}
            className="btn-primary w-full"
          >
            {isSpeaking ? "Book 15-minute speaking call" : "Book your session"}
          </button>
        )}
        <p className="text-xs text-[var(--muted)]">
          Coach contact: {contact.email}
          {contact.phone ? ` · ${formatPhoneDisplay(contact.phone)}` : ""}
        </p>
      </div>

      <details
        className="mt-6 card group"
        open={showRequestForm}
        onToggle={(e) => setShowRequestForm((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer list-none font-semibold text-[var(--muted)]">
          <span className="inline-block transition-transform group-open:rotate-90">▶</span>{" "}
          Backup: request a time (only if Calendly won&apos;t load)
        </summary>
        <div className="mt-4 space-y-4">
          <p className="text-xs text-[var(--muted)]">
            These slots follow coach availability in admin — not every hour every day. Jeremy confirms manually and sends Zoom details.
          </p>
          <div>
            <label className="block text-sm font-medium">Your email</label>
            <input
              className="input mt-1 w-full"
              type="email"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Your phone (optional)</label>
            <PhoneInput
              className="input mt-1 w-full"
              value={memberPhone}
              onChange={setMemberPhone}
              placeholder="916.284.1994"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Choose a day</label>
            <div className="flex flex-wrap gap-2">
              {dates.length === 0 && (
                <span className="text-sm text-[var(--muted)]">No availability set by coach yet — use Calendly above.</span>
              )}
              {dates.map((d) => {
                const sample = slots.find((s) => slotLocalDateKey(s.start) === d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setSelectedDate(d);
                      setSelectedSlot(null);
                    }}
                    className={`px-3 py-1 rounded text-sm border ${
                      selectedDate === d
                        ? "bg-accent text-[var(--text)] border-accent"
                        : "border-[var(--border)] hover:bg-[var(--surface-2)]"
                    }`}
                  >
                    {sample ? formatSlotDateLabel(sample.start) : d}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedDate && (
            <div>
              <label className="block text-sm font-medium mb-1">Choose 15-min window</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {slotsForDate.length === 0 && (
                  <span className="text-sm text-[var(--muted)] col-span-full">No slots for this day.</span>
                )}
                {slotsForDate.map((slot) => {
                  const isSel = selectedSlot?.start === slot.start;
                  return (
                    <button
                      key={slot.start}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`text-left card p-2 text-sm ${isSel ? "ring-2 ring-accent" : ""}`}
                    >
                      {formatSlotTimeRange(slot.start, slot.end)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => void book()}
            disabled={!selectedSlot || submitting || !memberEmail}
            className="btn-primary w-full disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Request this slot"}
          </button>

          {result && (
            <p className="text-sm text-[var(--success)] p-3 bg-[var(--success)]/10 rounded">{result}</p>
          )}
        </div>
      </details>

      <p className="mt-6 text-xs text-center text-[var(--muted)]">
        Live sessions use Zoom. Calendly handles scheduling; the form above is a backup if you can&apos;t use Calendly.
      </p>

      <EmbeddedCalendlyModal
        open={calendlyModalOpen}
        calendlyUrl={calendly}
        prefill={memberEmail ? { email: memberEmail } : undefined}
        title="Book with Coach Jeremy"
        onClose={() => setCalendlyModalOpen(false)}
        onScheduled={(details) => {
          setCalendlyBooked(true);
          void (async () => {
            const res = await fetch("/api/member/intake-scheduled", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                scheduledAt: details.scheduledAt || null,
                bookingSource: "calendly",
                calendlyEventUri: details.eventUri || null,
                calendlyInviteeUri: details.inviteeUri || null,
                calendlyRescheduleUrl: details.rescheduleUrl || null,
                calendlyCancelUrl: details.cancelUrl || null,
                phone: memberPhone || null,
              }),
            });
            if (!res.ok) return;
            const data = await res.json();
            if (typeof data.rescheduleUrl === "string" && data.rescheduleUrl) {
              setRescheduleUrl(data.rescheduleUrl);
            } else if (details.rescheduleUrl) {
              setRescheduleUrl(details.rescheduleUrl);
            }
            dispatchMemberScoreCelebrate({
              pointsEarned: data.pointsEarned ?? 0,
              totalPoints: data.totalPoints,
              label: "Intro booked",
            });
          })();
        }}
      />
    </div>
  );
}