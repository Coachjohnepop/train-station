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
  const [recommendation, setRecommendation] = useState<{ name: string; reason: string } | null>(null);
  const [joinName, setJoinName] = useState("");
  const [joinEmail, setJoinEmail] = useState("");
  const [joining, setJoining] = useState(false);

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
    let recName = "Explorer";
    let reason = "Perfect starting point to build consistency without overwhelm.";

    const freq = answers.exerciseFreq;
    const hasStructure = answers.structured === "yes";
    const tracksEating = answers.eating !== "no-track";
    const seriousGoal = ["build-muscle", "lose-fat"].includes(answers.goal);

    if (freq === "4+" && hasStructure && tracksEating) {
      recName = "Pro";
      reason = "You're already putting in the work — this gives you the deepest support and best value.";
    } else if ((freq === "2-3" || freq === "4+") && (hasStructure || tracksEating || seriousGoal)) {
      recName = "Member";
      reason = "Solid structure and accountability to take your results to the next level.";
    } else {
      recName = "Explorer";
      reason = "Great entry point to build the habit with less commitment.";
    }

    setRecommendation({ name: recName, reason });
    setSubmitted(true);
  };

  const handleRealJoin = async () => {
    setJoining(true);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: joinName || "New Member",
          email: joinEmail || undefined,
          plan: recommendation?.name?.toLowerCase(),
          programSlug: "adult", // default to the core workout program so the site is immediately useful
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.redirectTo) {
        window.location.href = data.redirectTo;
      } else {
        // fallback: still take them to member (cookie may be set or demo)
        window.location.href = "/member";
      }
    } catch {
      window.location.href = "/member";
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0612] text-[#f2ecf9]">
      <div className="border-b border-[#3d2660] bg-[#140a22]">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link href="/member" className="font-semibold tracking-tight text-lg hover:text-[var(--accent)]">
            The Train Station
          </Link>
          <Link href="/join" className="text-sm text-[#9d8ab8] hover:text-white">Skip to pricing</Link>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 pt-12 pb-20">
        <div className="text-center mb-10">
          <div className="uppercase tracking-[3px] text-xs font-semibold text-[#7c3aed] mb-3">GET STARTED</div>
          <h1 className="text-4xl font-semibold tracking-[-1.5px] mb-4">Tell us a bit about where you are today</h1>
          <p className="text-[#9d8ab8]">A few quick questions so we can recommend the best fit for you. (We'll refine the packages and recommendations soon.)</p>
        </div>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <label className="block text-sm font-medium mb-2">How many days per week do you currently exercise or train?</label>
              <select
                value={answers.exerciseFreq}
                onChange={(e) => updateAnswer("exerciseFreq", e.target.value)}
                className="w-full bg-[#140a22] border border-[#3d2660] rounded-xl px-4 py-3 text-white"
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
                className="w-full bg-[#140a22] border border-[#3d2660] rounded-xl px-4 py-3 text-white"
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
                className="w-full bg-[#140a22] border border-[#3d2660] rounded-xl px-4 py-3 text-white"
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
              See my recommendation
            </button>
          </form>
        ) : (
          <div className="space-y-8">
            <div className="rounded-3xl border border-[#7c3aed] bg-[#140a22] p-8">
              <div className="uppercase tracking-[2px] text-xs font-semibold text-[#7c3aed] mb-2">RECOMMENDATION</div>
              <div className="text-3xl font-semibold tracking-tight mb-2">{recommendation?.name}</div>
              <p className="text-[#9d8ab8] mb-6">{recommendation?.reason}</p>

              <div className="text-sm text-[#9d8ab8]">
                This is based on your current habits. We'll refine the exact packages and pricing soon — this is just to help you get started in the right place.
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Your name (optional)"
                  className="w-full rounded-full border border-[#3d2660] bg-[#140a22] px-4 py-3 text-sm text-white placeholder:text-[#9d8ab8]"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                />
                <input
                  type="email"
                  placeholder="Email (optional for demo)"
                  className="w-full rounded-full border border-[#3d2660] bg-[#140a22] px-4 py-3 text-sm text-white placeholder:text-[#9d8ab8]"
                  value={joinEmail}
                  onChange={(e) => setJoinEmail(e.target.value)}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href={`/join${recommendation ? `?rec=${encodeURIComponent(recommendation.name)}` : ''}`}
                  className="flex-1 inline-flex h-12 items-center justify-center rounded-full border border-[#3d2660] text-sm font-semibold hover:bg-white/5 transition-all"
                >
                  See all membership options
                </Link>
                <button
                  onClick={handleRealJoin}
                  disabled={joining}
                  className="flex-1 inline-flex h-12 items-center justify-center rounded-full bg-[#7c3aed] text-sm font-semibold text-white hover:bg-[#6d2dd6] transition-all disabled:opacity-60"
                >
                  {joining ? "Creating your account..." : `Start with the recommended (Back to the Program)`}
                </button>
              </div>
            </div>

            <p className="text-center text-xs text-[#9d8ab8]">
              Your answers help us guide you. You can always change plans later.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
