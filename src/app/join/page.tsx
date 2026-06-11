import Link from "next/link";

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
          <Link href="/" className="flex items-center gap-3">
            <img src="/images/logo.png" alt="The Train Station" className="h-9 w-auto" />
            <span className="font-semibold tracking-tight text-lg">The Train Station</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/landing" className="text-[#9d8ab8] hover:text-white transition">Explore programs</Link>
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
          All access is currently open while we finish billing setup. Plans launching soon.
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

      {/* Pricing overview */}
      <div id="plans" className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Explorer */}
          <div className={`rounded-3xl border ${isRecommended("Explorer") ? "border-[#7c3aed] ring-1 ring-[#7c3aed]/40" : "border-[#3d2660]"} bg-[#140a22] p-8 flex flex-col`}>
            <div>
              <div className="flex items-center gap-2">
                <div className="text-[#7c3aed] text-xs font-semibold tracking-widest">EXPLORER</div>
                {isRecommended("Explorer") && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#7c3aed] text-white font-semibold tracking-widest">RECOMMENDED</span>
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

            {/* Instructor video message for Explorer */}
            <div className="mt-6 pt-4 border-t border-[#3d2660]">
              <p className="text-xs uppercase tracking-widest text-[#7c3aed] mb-1">A message from the instructor</p>
              <p className="text-sm text-[#9d8ab8] mb-3 italic">
                "Starting here is how every great athlete began. Build the habit small and watch it compound."
              </p>
              <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
                {/* TODO: Replace VIDEO_ID with the actual YouTube video ID for the Explorer plan message */}
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/dQw4w9wgxcQ"
                  title="Instructor message for Explorer plan"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>
            </div>

            <Link
              href="/member"
              className="mt-8 inline-flex h-11 items-center justify-center rounded-full border border-[#3d2660] text-sm font-semibold hover:bg-white/5 transition-all hover:scale-[1.05]"
            >
              Enter as member (free now)
            </Link>
          </div>

          {/* Member */}
          <div className={`rounded-3xl border ${isRecommended("Member") ? "border-[#7c3aed] ring-2 ring-[#7c3aed]" : "border-[#7c3aed]"} bg-[#140a22] p-8 flex flex-col relative`}>
            <div className="absolute -top-3 right-6 rounded-full bg-[#7c3aed] px-3 py-0.5 text-xs font-semibold tracking-widest">POPULAR</div>
            <div>
              <div className="flex items-center gap-2">
                <div className="text-[#7c3aed] text-xs font-semibold tracking-widest">MEMBER</div>
                {isRecommended("Member") && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#7c3aed] text-white font-semibold tracking-widest">RECOMMENDED</span>
                )}
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight">$29</span>
                <span className="text-[#9d8ab8]">/mo</span>
              </div>
              <div className="text-[#9d8ab8] mt-1">or $290/year (save 17%)</div>
            </div>
            <ul className="mt-8 space-y-3 text-[15px] flex-1">
              <li className="flex gap-2">✓ Full access to all programs &amp; yoga channels</li>
              <li className="flex gap-2">✓ Complete set logging, pasts, silhouettes &amp; streaks</li>
              <li className="flex gap-2">✓ SMS reminders &amp; home equipment tracker</li>
              <li className="flex gap-2">✓ Live session replays &amp; community</li>
              <li className="flex gap-2">✓ Priority support from coaches</li>
            </ul>

            {/* Instructor video message for Member */}
            <div className="mt-6 pt-4 border-t border-[#3d2660]">
              <p className="text-xs uppercase tracking-widest text-[#7c3aed] mb-1">A message from the instructor</p>
              <p className="text-sm text-[#9d8ab8] mb-3 italic">
                "This is the plan where real accountability kicks in. The structure here turns effort into lasting results."
              </p>
              <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
                {/* TODO: Replace VIDEO_ID with the actual YouTube video ID for the Member plan message */}
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/3JZ_9j6z8fQ"
                  title="Instructor message for Member plan"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>
            </div>

            <Link
              href="/member"
              className="mt-8 inline-flex h-11 items-center justify-center rounded-full bg-[#7c3aed] text-sm font-semibold text-white hover:bg-[#6d2dd6] transition-all hover:scale-[1.05]"
            >
              Start 14-day trial (demo)
            </Link>
            <p className="text-center text-[10px] text-[#9d8ab8] mt-2">Billed monthly or annually. Cancel anytime.</p>
          </div>

          {/* Pro / Annual focused */}
          <div className={`rounded-3xl border ${isRecommended("Pro") ? "border-[#7c3aed] ring-1 ring-[#7c3aed]/40" : "border-[#3d2660]"} bg-[#140a22] p-8 flex flex-col`}>
            <div>
              <div className="flex items-center gap-2">
                <div className="text-[#7c3aed] text-xs font-semibold tracking-widest">PRO</div>
                {isRecommended("Pro") && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#7c3aed] text-white font-semibold tracking-widest">RECOMMENDED</span>
                )}
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight">$15</span>
                <span className="text-[#9d8ab8]">/mo</span>
              </div>
              <div className="text-[#9d8ab8] mt-1">billed annually ($180/year)</div>
            </div>
            <ul className="mt-8 space-y-3 text-[15px] flex-1">
              <li className="flex gap-2">✓ Everything in Member</li>
              <li className="flex gap-2">✓ Unlimited coach check-ins &amp; form reviews</li>
              <li className="flex gap-2">✓ Early access to new programs &amp; challenges</li>
              <li className="flex gap-2">✓ Personalized progress reports</li>
              <li className="flex gap-2">✓ Best value for committed athletes</li>
            </ul>

            {/* Instructor video message for Pro */}
            <div className="mt-6 pt-4 border-t border-[#3d2660]">
              <p className="text-xs uppercase tracking-widest text-[#7c3aed] mb-1">A message from the instructor</p>
              <p className="text-sm text-[#9d8ab8] mb-3 italic">
                "Committing for the year is how the serious athletes separate themselves. This plan gives you the deepest level of support and priority access."
              </p>
              <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
                {/* TODO: Replace VIDEO_ID with the actual YouTube video ID for the Pro plan message */}
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/fJ9rUzIMcZQ"
                  title="Instructor message for Pro plan"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>
            </div>

            <Link
              href="/member"
              className="mt-8 inline-flex h-11 items-center justify-center rounded-full border border-[#3d2660] text-sm font-semibold hover:bg-white/5 transition-all hover:scale-[1.05]"
            >
              Go Pro (demo)
            </Link>
          </div>
        </div>

        {/* Note */}
        <div className="mt-10 text-center text-sm text-[#9d8ab8] max-w-md mx-auto">
          Everything is currently free and fully open while we finish billing and subscription infrastructure. 
          The buttons above take you straight into the demo experience.
        </div>

        {/* Also link the coach side */}
        <div className="mt-8 text-center">
          <Link href="/admin" className="text-sm text-[#7c3aed] hover:underline">
            Looking for coach / admin tools? →
          </Link>
        </div>
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
