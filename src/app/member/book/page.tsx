"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { COACH_CALENDLY_URL } from "@/lib/brand";

type Slot = { start: string; end: string; label: string };

export default function MemberBookPage() {
  const [contact, setContact] = useState<{ email: string; phone?: string } | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [memberEmail, setMemberEmail] = useState("demo@thetrainstation.co");
  const [memberPhone, setMemberPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [cRes, sRes] = await Promise.all([
        fetch("/api/admin/contact"),
        fetch("/api/bookings?slots=true"),
      ]);
      if (cRes.ok) setContact(await cRes.json());
      if (sRes.ok) setSlots(await sRes.json());
    })();
  }, []);

  // Group slots by date
  const dates = Array.from(new Set(slots.map((s) => s.start.slice(0, 10)))).sort();

  const slotsForDate = selectedDate
    ? slots.filter((s) => s.start.startsWith(selectedDate))
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
      setResult("Booking request submitted! The coach will confirm via email/phone during the call. They will also ask what time each day you'd like an SMS reminder with a direct link to that day's workout in the app.");
      // clear selection
      setSelectedSlot(null);
    } catch (e: any) {
      setResult(e.message || "Could not submit booking. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!contact) return <p className="mt-6 text-center text-[var(--muted)]">Loading booking info…</p>;

  const calendly = (contact as any).calendlyUrl || COACH_CALENDLY_URL;

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/member" className="text-xs text-accent hover:underline">← Back to dashboard</Link>

      <h1 className="mt-3 text-2xl font-bold">Book your onboarding call</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        All new members book a 15-minute Zoom intro with the coach before accessing live sessions (1st Class) or full platform features.
      </p>

      <div className="mt-6 card">
        <h2 className="font-semibold">Coach Contact</h2>
        <p className="mt-1 text-sm">{contact.email} {contact.phone && `• ${contact.phone}`}</p>
        <p className="mt-2 text-sm">
          Quick book: <a href={calendly} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Calendly →</a>
        </p>
      </div>

      <div className="mt-6 card space-y-4">
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
          <input
            className="input mt-1 w-full"
            value={memberPhone}
            onChange={(e) => setMemberPhone(e.target.value)}
            placeholder="(555) 555-5555"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Choose a day</label>
          <div className="flex flex-wrap gap-2">
            {dates.length === 0 && <span className="text-sm text-[var(--muted)]">No availability set by coach yet.</span>}
            {dates.map((d) => (
              <button
                key={d}
                onClick={() => {
                  setSelectedDate(d);
                  setSelectedSlot(null);
                }}
                className={`px-3 py-1 rounded text-sm border ${selectedDate === d ? "bg-accent text-white border-accent" : "border-[var(--border)] hover:bg-[var(--surface-2)]"}`}
              >
                {new Date(d).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
              </button>
            ))}
          </div>
        </div>

        {selectedDate && (
          <div>
            <label className="block text-sm font-medium mb-1">Choose 15-min window</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {slotsForDate.length === 0 && <span className="text-sm text-[var(--muted)] col-span-full">No slots for this day.</span>}
              {slotsForDate.map((slot, idx) => {
                const key = slot.start;
                const isSel = selectedSlot?.start === slot.start;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedSlot(slot)}
                    className={`text-left card p-2 text-sm ${isSel ? "ring-2 ring-accent" : ""}`}
                  >
                    {slot.label} — {new Date(slot.end).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <button
          onClick={book}
          disabled={!selectedSlot || submitting || !memberEmail}
          className="btn-primary w-full disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Book this slot"}
        </button>

        {result && (
          <p className="text-sm text-[var(--success)] p-3 bg-[var(--success)]/10 rounded">{result}</p>
        )}
      </div>

      <p className="mt-6 text-xs text-center text-[var(--muted)]">
        After booking, the coach will reach out to confirm and share the Zoom details. Coach tier = on-demand only. 1st Class unlocks live sessions.
      </p>
    </div>
  );
}
