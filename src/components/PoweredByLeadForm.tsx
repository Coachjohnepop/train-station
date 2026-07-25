"use client";

import { useState } from "react";

const MODULES = [
  { id: "member-today", label: "Member Today & Day Complete" },
  { id: "programs", label: "Program calendar & templates" },
  { id: "maintain", label: "Quick maintain / muscle-group sessions" },
  { id: "live-class", label: "Live class (Zoom) + coach floor" },
  { id: "messages", label: "Coach–member Messages + alerts" },
  { id: "payments", label: "Memberships, Venmo, Stripe, tips" },
  { id: "gamification", label: "Points, leaderboard, free-pool access" },
  { id: "admin", label: "Admin / coach back office" },
] as const;

export default function PoweredByLeadForm() {
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [about, setAbout] = useState("");
  const [modules, setModules] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleModule(id: string) {
    setModules((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/powered-by/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          contactName,
          email,
          phone: phone || null,
          about: about || null,
          modules,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Could not send — try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-[var(--success,#34c759)]/40 bg-[color-mix(in_srgb,var(--success,#34c759)_10%,var(--surface))] p-6 text-center">
        <p className="text-lg font-semibold text-[var(--text)]">Thanks — we got it.</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Someone from Lemonvoice will reach out about demo &amp; pricing for a platform like
          The Train Station.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[var(--text)]">Company name *</span>
          <input
            className="input w-full"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            autoComplete="organization"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[var(--text)]">Contact name *</span>
          <input
            className="input w-full"
            required
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            autoComplete="name"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[var(--text)]">Email *</span>
          <input
            className="input w-full"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[var(--text)]">Phone</span>
          <input
            className="input w-full"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />
        </label>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-[var(--text)]">
          Which pieces interest you?
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {MODULES.map((m) => {
            const on = modules.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleModule(m.id)}
                className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                  on
                    ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_14%,var(--surface))] font-medium text-[var(--text)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--accent)]/50"
                }`}
                aria-pressed={on}
              >
                {on ? "✓ " : ""}
                {m.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-[var(--text)]">About your business</span>
        <textarea
          className="input min-h-[100px] w-full resize-y py-2"
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          placeholder="Gym, private coach, multi-location studio… what are you running today?"
        />
      </label>

      {error ? (
        <p className="text-sm font-medium text-[var(--danger,#ef4444)]" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="btn-primary w-full min-h-[48px] rounded-xl py-3 text-sm font-semibold sm:w-auto sm:px-8"
      >
        {busy ? "Sending…" : "Request a demo & pricing"}
      </button>
    </form>
  );
}
