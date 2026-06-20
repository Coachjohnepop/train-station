import Link from "next/link";
import PricingWithInlineSignup from "@/components/PricingWithInlineSignup";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ rec?: string }>
}) {
  const params = await searchParams;
  const recParam = (params.rec || "").toLowerCase();
  const isRecommended = (name: string) => recParam === name.toLowerCase();

  return (
    <div className="min-h-screen bg-[#0a0612] text-[#f2ecf9]">
      {/* Simple header */}
      <div className="border-b border-[#3d2660] bg-[#140a22]">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link href="/member" className="font-semibold tracking-tight text-lg hover:text-[var(--accent)]">
            The Train Station
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/member/programs" className="text-[#9d8ab8] hover:text-white transition">Explore programs</Link>
            <Link href="/member" className="text-[#9d8ab8] hover:text-white transition">Enter as member</Link>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="mx-auto max-w-3xl px-6 pt-16 pb-10 text-center">
        <div className="uppercase tracking-[3px] text-xs font-semibold text-[#7c3aed] mb-3">MEMBERSHIPS</div>
        <h1 className="text-5xl font-semibold tracking-[-1.8px] mb-4">Join The Train Station</h1>
        <p className="text-xl text-[#9d8ab8] max-w-xl mx-auto">
          Professional programs, real accountability, and the tools coaches actually use — now available for members.
        </p>
        <div className="mt-6 text-sm text-[#9d8ab8]">
          The full member app is coming soon. Sign up below and we&apos;ll notify you when your spot opens.
        </div>
        <div className="mt-4">
          <Link
            href="/signup"
            className="inline-flex h-10 items-center justify-center rounded-full bg-[#7c3aed] px-6 text-sm font-semibold text-white hover:bg-[#6d2dd6] transition"
          >
            Join the waitlist →
          </Link>
        </div>
      </div>

      {/* Middle assessment step (per transcript): questions about current exercise/eating before showing full pricing. Landing "Join the site" already points here; this reinforces on the /join page itself. Now supports ?rec= from the wizard. */}
      <div className="mx-auto max-w-2xl px-6 -mt-4 mb-8 text-center">
        <div className="inline-block rounded-full bg-[#7c3aed]/10 px-3 py-1 text-xs font-semibold tracking-widest text-[#7c3aed] mb-2">NOT SURE WHICH PLAN?</div>
        <p className="text-[#9d8ab8] text-sm">Answer 4 quick questions about your current training frequency, structure, eating habits, and goals. We'll recommend Explorer, Member, or Pro.</p>
        <div className="mt-3 flex items-center justify-center gap-3">
          <Link
            href="/join/questions"
            className="inline-flex h-10 items-center justify-center rounded-full bg-[#7c3aed] px-5 text-sm font-semibold text-white hover:bg-[#6d2dd6] transition-all"
          >
            Take the 1-minute assessment →
          </Link>
          <a href="#plans" className="text-sm text-[#9d8ab8] hover:text-white underline">or skip to plans</a>
        </div>
      </div>

      {/* Pricing overview with inline signup after choosing a plan */}
      <div id="plans" className="mx-auto max-w-6xl px-6 pb-16">
        <PricingWithInlineSignup recParam={recParam} />
      </div>

      {/* Footer CTA */}
      <div className="border-t border-[#3d2660] py-10 bg-[#140a22]">
        <div className="mx-auto max-w-xl text-center px-6">
          <p className="text-[#9d8ab8] mb-4">Questions about plans or need a custom team option?</p>
          <Link href="/admin" className="inline-flex h-11 items-center justify-center rounded-full border border-[#3d2660] px-8 text-sm font-semibold hover:bg-white/5 transition-all hover:scale-[1.05]">
            Talk to the team
          </Link>
        </div>
      </div>
    </div>
  );
}
