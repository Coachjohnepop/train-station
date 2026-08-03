"use client";

import Link from "next/link";
import { useState } from "react";
import PhoneInput from "@/components/PhoneInput";
import CityStateInput from "@/components/CityStateInput";
import {
  SPEAKING_AUDIENCE_SIZES,
  SPEAKING_BUDGET_RANGES,
  SPEAKING_EVENT_TYPES,
  SPEAKING_FORMATS,
} from "@/lib/speaking-inquiry-client";

const TOTAL_STEPS = 5;

export default function SpeakingIntakeWizard({
  email = "",
  name = "",
}: {
  email?: string;
  name?: string;
}) {
  const [step, setStep] = useState(1);
  const [eventType, setEventType] = useState("keynote");
  const [format, setFormat] = useState("undecided");
  const [audienceSize, setAudienceSize] = useState("unknown");
  const [audienceDesc, setAudienceDesc] = useState("");
  const [organization, setOrganization] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState({ city: "", state: "" });
  const [budgetRange, setBudgetRange] = useState("prefer_not");
  const [topicsGoals, setTopicsGoals] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function next() {
    setError(null);
    if (step === 2 && !eventType) {
      setError("Pick an event type.");
      return;
    }
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }

  function prev() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/speaking/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType,
          format,
          audienceSize,
          audienceDesc: audienceDesc || null,
          organization: organization || null,
          eventDate: eventDate || null,
          locationCity: location.city || null,
          locationState: location.state || null,
          budgetRange,
          topicsGoals: topicsGoals || null,
          extraNotes: extraNotes || null,
          phone: phone || null,
          name: name || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save intake.");
      window.location.replace(
        data.redirectTo || "/member/book?purpose=speaking",
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Submit failed");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-[#7c3aed]/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#c4b5fd]">
          Speaking intake
        </span>
        <div className="text-xs text-[var(--muted)]">
          Step {step} of {TOTAL_STEPS}
        </div>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div
          className="h-full rounded-full bg-[#7c3aed] transition-all duration-300"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      <div className="card space-y-4 p-5 sm:p-6">
        {step === 1 && (
          <>
            <div className="overflow-hidden rounded-xl border border-[var(--border)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/programs/speaking.jpg"
                alt="Coach Jeremy speaking at a seminar"
                className="aspect-[16/9] w-full object-cover"
              />
            </div>
            <h1 className="text-xl font-bold">Tell us about your event</h1>
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              A short intake so Coach Jeremy can scope your speaking request.
              After this wizard you&apos;ll book a <strong className="text-[var(--text)]">15-minute
              call</strong> — same as a new member intro.
            </p>
            {email ? (
              <p className="text-xs text-[var(--muted)]">
                Signed in as <span className="text-[var(--text)]">{email}</span>
              </p>
            ) : null}
            <button type="button" onClick={next} className="btn-primary w-full">
              Start intake →
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-xl font-bold">Event type &amp; format</h1>
            <p className="text-sm text-[var(--muted)]">What kind of speaking is this?</p>
            <div className="grid gap-2">
              {SPEAKING_EVENT_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setEventType(t.id)}
                  className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                    eventType === t.id
                      ? "border-accent bg-accent/15 text-[var(--text)]"
                      : "border-[var(--border)] text-[var(--muted)] hover:border-accent/40"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="pt-2 text-sm font-medium text-[var(--text)]">Format</p>
            <div className="grid grid-cols-2 gap-2">
              {SPEAKING_FORMATS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFormat(t.id)}
                  className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                    format === t.id
                      ? "border-accent bg-accent/15 text-[var(--text)]"
                      : "border-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="text-xl font-bold">Audience &amp; organization</h1>
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--muted)]">Expected audience size</span>
              <select
                className="input w-full"
                value={audienceSize}
                onChange={(e) => setAudienceSize(e.target.value)}
              >
                {SPEAKING_AUDIENCE_SIZES.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--muted)]">Who is the audience?</span>
              <textarea
                className="input min-h-[72px] w-full"
                placeholder="e.g. high school athletes, corporate leadership, coaches…"
                value={audienceDesc}
                onChange={(e) => setAudienceDesc(e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--muted)]">Organization / host</span>
              <input
                className="input w-full"
                placeholder="School, company, conference…"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
              />
            </label>
          </>
        )}

        {step === 4 && (
          <>
            <h1 className="text-xl font-bold">When &amp; where</h1>
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--muted)]">Event date (if known)</span>
              <input
                type="date"
                className="input w-full"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </label>
            <p className="text-xs text-[var(--muted)]">
              Leave blank if the date is flexible — you&apos;ll cover timing on the 15-min call.
            </p>
            {(format === "in_person" || format === "hybrid") && (
              <div className="space-y-1">
                <span className="text-sm text-[var(--muted)]">City / state for in-person</span>
                <CityStateInput
                  city={location.city}
                  state={location.state}
                  onCityChange={(city) => setLocation((loc) => ({ ...loc, city }))}
                  onStateChange={(state) => setLocation((loc) => ({ ...loc, state }))}
                />
              </div>
            )}
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--muted)]">Budget range (optional)</span>
              <select
                className="input w-full"
                value={budgetRange}
                onChange={(e) => setBudgetRange(e.target.value)}
              >
                {SPEAKING_BUDGET_RANGES.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        {step === 5 && (
          <>
            <h1 className="text-xl font-bold">Topics &amp; contact</h1>
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--muted)]">Topics / goals for the talk</span>
              <textarea
                className="input min-h-[96px] w-full"
                placeholder="What should the audience walk away with?"
                value={topicsGoals}
                onChange={(e) => setTopicsGoals(e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--muted)]">Anything else?</span>
              <textarea
                className="input min-h-[64px] w-full"
                placeholder="AV needs, multiple sessions, travel notes…"
                value={extraNotes}
                onChange={(e) => setExtraNotes(e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--muted)]">Best phone (for the call)</span>
              <PhoneInput value={phone} onChange={setPhone} />
            </label>
            <p className="rounded-lg border border-accent/25 bg-accent/10 px-3 py-2 text-xs text-[var(--muted)]">
              Next: book your <strong className="text-[var(--text)]">15-minute</strong> scope call
              with Jeremy on Calendly — same flow as a new member intro.
            </p>
          </>
        )}

        {error && (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            {error}
          </p>
        )}

        {step > 1 && (
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={prev} className="btn-secondary flex-1" disabled={submitting}>
              Back
            </button>
            {step < TOTAL_STEPS ? (
              <button type="button" onClick={next} className="btn-primary flex-1">
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void submit()}
                className="btn-primary flex-1"
                disabled={submitting}
              >
                {submitting ? "Saving…" : "Save & book 15-min call →"}
              </button>
            )}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-[var(--muted)]">
        <Link href="/member" className="text-accent hover:underline">
          Member home
        </Link>
        {" · "}
        Not for speaking?{" "}
        <Link href="/join#programs" className="text-accent hover:underline">
          Browse training programs
        </Link>
      </p>
    </div>
  );
}
