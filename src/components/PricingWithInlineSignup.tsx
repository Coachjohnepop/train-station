"use client";

import { useState } from "react";
import Link from "next/link";
import EmailInput, { rememberEmail } from "@/components/EmailInput";
import YoutubeAutoplayFrame from "@/components/YoutubeAutoplayFrame";

const PLAN_VIDEOS = {
  explorer: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  member: "https://www.youtube.com/watch?v=3JZ_9j6z8fQ",
  pro: "https://www.youtube.com/watch?v=fJ9rUzIMcZQ",
} as const;

export default function PricingWithInlineSignup({ recParam }: { recParam?: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [joining, setJoining] = useState(false);

  const isRecommended = (planName: string) => (recParam || "").toLowerCase() === planName.toLowerCase();

  const handleSelect = (plan: string) => {
    setSelected(plan);
    // scroll to form if needed
    setTimeout(() => {
      document.getElementById("inline-signup")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const handleSignup = async () => {
    if (!selected) return;
    setJoining(true);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || "New Member",
          email: email || undefined,
          plan: selected.toLowerCase(),
          programSlug: "adult",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (email.trim()) rememberEmail(email);
      if (res.ok && data.redirectTo) {
        window.location.href = data.redirectTo;
      } else {
        window.location.href = "/signup";
      }
    } catch {
      window.location.href = "/signup";
    } finally {
      setJoining(false);
    }
  };

  return (
    <>
      <div className="grid md:grid-cols-3 gap-6">
        {/* Explorer */}
        <div
          onClick={() => handleSelect("Explorer")}
          className={`cursor-pointer rounded-3xl border ${selected === "Explorer" ? "border-[#7c3aed] ring-2 ring-[#7c3aed]" : isRecommended("Explorer") ? "border-[#7c3aed] ring-1 ring-[#7c3aed]/40" : "border-[#3d2660]"} bg-[#140a22] p-8 flex flex-col transition-all hover:shadow-lg ${selected === "Explorer" ? "scale-[1.01]" : ""}`}
        >
          <div>
            <div className="flex items-center gap-2">
              <div className="text-[#7c3aed] text-xs font-semibold tracking-widest">EXPLORER</div>
              {isRecommended("Explorer") && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#7c3aed] text-white font-semibold tracking-widest">RECOMMENDED</span>
              )}
              {selected === "Explorer" && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-white text-[#7c3aed] font-semibold tracking-widest">SELECTED</span>
              )}
            </div>
            <div className="mt-2 text-4xl font-semibold tracking-tight">Free</div>
            <div className="text-[#9d8ab8] mt-1">No card required</div>
          </div>
          <ul className="mt-8 space-y-3 text-[15px] flex-1">
            <li className="flex gap-2">✓ Access to select starter programs</li>
            <li className="flex gap-2">✓ Basic workout logging &amp; streaks</li>
            <li className="flex gap-2">✓ Public program library</li>
            <li className="flex gap-2 text-[#9d8ab8]">— Limited SMS reminders</li>
            <li className="flex gap-2 text-[#9d8ab8]">— No coach review priority</li>
          </ul>

          <div className="mt-6 pt-4 border-t border-[#3d2660]">
            <p className="text-xs uppercase tracking-widest text-[#7c3aed] mb-1">A message from the instructor</p>
            <p className="text-sm text-[#9d8ab8] mb-3 italic">
              "Starting here is how every great athlete began. Build the habit small and watch it compound."
            </p>
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
              <YoutubeAutoplayFrame
                className="h-full w-full"
                videoUrl={PLAN_VIDEOS.explorer}
                title="Instructor message for Explorer plan"
                autoplay
                kickPlayback
              />
            </div>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); handleSelect("Explorer"); }}
            className="mt-8 inline-flex h-11 items-center justify-center rounded-full border border-[#3d2660] text-sm font-semibold !text-[#7c3aed] hover:bg-white/5 transition-all hover:scale-[1.05]"
          >
            Select this plan
          </button>
        </div>

        {/* Member */}
        <div
          onClick={() => handleSelect("Member")}
          className={`cursor-pointer rounded-3xl border ${selected === "Member" ? "border-[#7c3aed] ring-2 ring-[#7c3aed]" : isRecommended("Member") ? "border-[#7c3aed] ring-2 ring-[#7c3aed]" : "border-[#7c3aed]"} bg-[#140a22] p-8 flex flex-col relative transition-all hover:shadow-lg ${selected === "Member" ? "scale-[1.01]" : ""}`}
        >
          <div className="absolute -top-3 right-6 rounded-full bg-[#7c3aed] px-3 py-0.5 text-xs font-semibold tracking-widest">POPULAR</div>
          <div>
            <div className="flex items-center gap-2">
              <div className="text-[#7c3aed] text-xs font-semibold tracking-widest">COACH CLASS</div>
              {isRecommended("Member") && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#7c3aed] text-white font-semibold tracking-widest">RECOMMENDED</span>
              )}
              {selected === "Member" && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-white text-[#7c3aed] font-semibold tracking-widest">SELECTED</span>
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-4xl font-semibold tracking-tight">$25</span>
              <span className="text-[#9d8ab8]">/mo</span>
            </div>
          </div>
          <ul className="mt-8 space-y-3 text-[15px] flex-1">
            <li className="flex gap-2">✓ All programs — 4-week blocks</li>
            <li className="flex gap-2">✓ 15-min coach Zoom</li>
            <li className="flex gap-2">✓ SMS accountability texts</li>
            <li className="flex gap-2">✓ Set logging, streaks &amp; home equipment</li>
          </ul>

          <div className="mt-6 pt-4 border-t border-[#3d2660]">
            <p className="text-xs uppercase tracking-widest text-[#7c3aed] mb-1">A message from the instructor</p>
            <p className="text-sm text-[#9d8ab8] mb-3 italic">
              "This is the plan where real accountability kicks in. The structure here turns effort into lasting results."
            </p>
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
              <YoutubeAutoplayFrame
                className="h-full w-full"
                videoUrl={PLAN_VIDEOS.member}
                title="Instructor message for Member plan"
                autoplay
                kickPlayback
              />
            </div>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); handleSelect("Member"); }}
            className="mt-8 inline-flex h-11 items-center justify-center rounded-full bg-[#7c3aed] text-sm font-semibold text-white hover:bg-[#6d2dd6] transition-all hover:scale-[1.05]"
          >
            Select this plan
          </button>
          <p className="text-center text-[10px] text-[#9d8ab8] mt-2">Billed monthly. Cancel anytime.</p>
        </div>

        {/* Pro */}
        <div
          onClick={() => handleSelect("Pro")}
          className={`cursor-pointer rounded-3xl border ${selected === "Pro" ? "border-[#7c3aed] ring-2 ring-[#7c3aed]" : isRecommended("Pro") ? "border-[#7c3aed] ring-1 ring-[#7c3aed]/40" : "border-[#3d2660]"} bg-[#140a22] p-8 flex flex-col transition-all hover:shadow-lg ${selected === "Pro" ? "scale-[1.01]" : ""}`}
        >
          <div>
            <div className="flex items-center gap-2">
              <div className="text-[#7c3aed] text-xs font-semibold tracking-widest">1ST CLASS</div>
              {isRecommended("Pro") && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#7c3aed] text-white font-semibold tracking-widest">RECOMMENDED</span>
              )}
              {selected === "Pro" && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-white text-[#7c3aed] font-semibold tracking-widest">SELECTED</span>
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-4xl font-semibold tracking-tight">$50</span>
              <span className="text-[#9d8ab8]">/mo</span>
            </div>
          </div>
          <ul className="mt-8 space-y-3 text-[15px] flex-1">
            <li className="flex gap-2">✓ Everything in Coach Class</li>
            <li className="flex gap-2">✓ Live Zoom with John &amp; Steph</li>
            <li className="flex gap-2">✓ 20-min Zoom with Coach Byrd</li>
          </ul>

          <div className="mt-6 pt-4 border-t border-[#3d2660]">
            <p className="text-xs uppercase tracking-widest text-[#7c3aed] mb-1">A message from the instructor</p>
            <p className="text-sm text-[#9d8ab8] mb-3 italic">
              "Committing for the year is how the serious athletes separate themselves. This plan gives you the deepest level of support and priority access."
            </p>
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
              <YoutubeAutoplayFrame
                className="h-full w-full"
                videoUrl={PLAN_VIDEOS.pro}
                title="Instructor message for Pro plan"
                autoplay
                kickPlayback
              />
            </div>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); handleSelect("Pro"); }}
            className="mt-8 inline-flex h-11 items-center justify-center rounded-full border border-[#3d2660] text-sm font-semibold hover:bg-white/5 transition-all hover:scale-[1.05]"
          >
            Select this plan
          </button>
        </div>
      </div>

      {/* Inline signup form after choosing a plan */}
      {selected && (
        <div id="inline-signup" className="mx-auto max-w-2xl mt-8 p-8 rounded-3xl border border-[#7c3aed] bg-[#140a22]">
          <div className="text-center mb-6">
            <div className="uppercase tracking-[3px] text-xs font-semibold text-[#7c3aed] mb-2">SIGN UP</div>
            <h3 className="text-2xl font-semibold tracking-tight">Get notified for {selected}</h3>
            <p className="text-sm text-[#9d8ab8] mt-1">The app is coming soon — we&apos;ll email you when {selected} access opens.</p>
          </div>

          <div className="space-y-4 max-w-md mx-auto">
            <input
              type="text"
              placeholder="Your name (optional)"
              className="w-full rounded-full border border-[#3d2660] bg-[#0a0612] px-4 py-3 text-sm text-white placeholder:text-[#9d8ab8]"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <EmailInput
              variant="signup"
              placeholder="Email (optional for demo)"
              value={email}
              onChange={setEmail}
            />

            <button
              onClick={handleSignup}
              disabled={joining}
              className="w-full inline-flex h-12 items-center justify-center rounded-full bg-[#7c3aed] text-sm font-semibold text-white hover:bg-[#6d2dd6] transition-all disabled:opacity-60"
            >
              {joining ? "Saving your spot..." : `Join waitlist for ${selected}`}
            </button>

            <button
              onClick={() => setSelected(null)}
              className="w-full text-xs text-[#9d8ab8] hover:text-white mt-1"
            >
              Choose a different plan
            </button>
          </div>

          <p className="text-center text-xs text-[#9d8ab8] mt-4">
            Your answers from the assessment (if any) help us guide you. You can always change plans later.
          </p>
        </div>
      )}

      {/* Note */}
      <div className="mt-10 text-center text-sm text-[#9d8ab8] max-w-md mx-auto">
        Selecting a plan adds you to the waitlist. Invited coaches and early members can{" "}
        <Link href="/login" className="text-[#7c3aed] hover:underline">sign in here</Link>.
      </div>

      {/* Also link the coach side */}
      <div className="mt-8 text-center">
        <Link href="/admin" className="text-sm text-[#7c3aed] hover:underline">
          Looking for coach / admin tools? →
        </Link>
      </div>
    </>
  );
}
