"use client";

import { useState } from "react";
import Link from "next/link";

type Answers = {
  exerciseFreq: string;
  structured: string;
  eating: string;
  goal: string;
};

export default function JoinQuestionsPage() {
  const [answers, setAnswers] = useState<Answers>({
    exerciseFreq: "",
    structured: "",
    eating: "",
    goal: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [recommendation, setRecommendation] = useState<{
    name: string;
    label: string;
    reason: string;
  } | null>(null);

  const updateAnswer = (key: keyof Answers, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answers.exerciseFreq || !answers.structured || !answers.eating || !answers.goal) {
      alert("Please answer all questions.");
      return;
    }

    // Simple recommendation logic (will be refined when packages are adjusted)
    let recName = "explorer";
    let recLabel = "Free";
    let reason = "Start on the floor. Build the habit. Upgrade when you want Jeremy in your corner.";

    const freq = answers.exerciseFreq;
    const hasStructure = answers.structured === "yes";
    const tracksEating = answers.eating !== "no-track";
    const seriousGoal = ["build-muscle", "lose-fat"].includes(answers.goal);

    if (freq === "4+" && hasStructure && tracksEating) {
      recName = "pro";
      recLabel = "1st Class";
      reason = "You're already in it. Eight private sessions + the full station — go deep.";
    } else if ((freq === "2-3" || freq === "4+") && (hasStructure || tracksEating || seriousGoal)) {
      recName = "member";
      recLabel = "Coach Class";
      reason = "This is the accountability seat. Programs, texts, and Jeremy on the line.";
    }

    setRecommendation({ name: recName, label: recLabel, reason });
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link href="/join" className="font-semibold tracking-tight text-lg hover:text-[var(--accent)]">
            The Train Station
          </Link>
          <Link href="/join" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">Skip to tickets</Link>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 pt-12 pb-20">
        <div className="text-center mb-10">
          <div className="uppercase tracking-[3px] text-xs font-semibold text-[#7c3aed] mb-3">
            60 seconds
          </div>
          <h1 className="text-4xl font-semibold tracking-[-1.5px] mb-4">
            Where are you starting?
          </h1>
          <p className="text-[var(--muted)]">
            Four taps. We point you at a seat — Free, Coach Class, or 1st.
          </p>
        </div>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <label className="block text-sm font-medium mb-2">How many days per week do you currently exercise or train?</label>
              <select
                value={answers.exerciseFreq}
                onChange={(e) => updateAnswer("exerciseFreq", e.target.value)}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--text)]"
                required
              >
                <option value="">Select...</option>
                <option value="0-1">0-1 days</option>
                <option value="2-3">2-3 days</option>
                <option value="4+">4+ days</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Do you currently follow a structured workout program?</label>
              <div className="flex gap-4">
                {["yes", "no"].map((val) => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="structured"
                      value={val}
                      checked={answers.structured === val}
                      onChange={(e) => updateAnswer("structured", e.target.value)}
                      className="accent-[#7c3aed]"
                      required
                    />
                    <span className="capitalize">{val}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">How do you currently handle your eating / nutrition?</label>
              <select
                value={answers.eating}
                onChange={(e) => updateAnswer("eating", e.target.value)}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--text)]"
                required
              >
                <option value="">Select...</option>
                <option value="no-track">I don't really track</option>
                <option value="sometimes">I track calories or macros sometimes</option>
                <option value="follow-plan">I follow a specific plan or work with a coach</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">What's your main goal right now?</label>
              <select
                value={answers.goal}
                onChange={(e) => updateAnswer("goal", e.target.value)}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--text)]"
                required
              >
                <option value="">Select...</option>
                <option value="build-muscle">Build strength or muscle</option>
                <option value="lose-fat">Lose fat / improve body composition</option>
                <option value="general">Build consistency and overall fitness</option>
                <option value="other">Other / not sure yet</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full mt-4 inline-flex h-12 items-center justify-center rounded-full bg-[#7c3aed] text-sm font-semibold text-white hover:bg-[#6d2dd6] transition-all"
            >
              Show me a seat
            </button>
          </form>
        ) : (
          <div className="space-y-8">
            <div className="rounded-3xl border border-[#7c3aed] bg-[var(--surface)] p-8">
              <div className="uppercase tracking-[2px] text-xs font-semibold text-[#7c3aed] mb-2">
                Your seat
              </div>
              <div className="text-3xl font-semibold tracking-tight mb-2">
                {recommendation?.label}
              </div>
              <p className="text-[var(--muted)] mb-6">{recommendation?.reason}</p>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href={`/join${recommendation ? `?rec=${encodeURIComponent(recommendation.name)}` : ''}`}
                  className="flex-1 inline-flex h-12 items-center justify-center rounded-full border border-[var(--border)] text-sm font-semibold hover:bg-white/5 transition-all"
                >
                  See all membership options
                </Link>
                <Link
                  href={`/signup?plan=${encodeURIComponent(recommendation?.name || "explorer")}`}
                  className="flex-1 inline-flex h-12 items-center justify-center rounded-full bg-[#7c3aed] text-sm font-semibold text-white hover:bg-[#6d2dd6] transition-all"
                >
                  Board {recommendation?.label || "now"}
                </Link>
              </div>
            </div>

            <p className="text-center text-xs text-[var(--muted)]">
              Your answers help us guide you. You can always change plans later.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
