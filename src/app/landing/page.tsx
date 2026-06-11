import Link from "next/link";
import { listPrograms } from "@/lib/program-data";
import LandingHero from "@/components/LandingHero";
import { PROGRAM_IMAGES } from "@/lib/program-constants";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const programs = await listPrograms();

  const programImages = PROGRAM_IMAGES;

  return (
    <div className="min-h-screen bg-[#0a0612] text-[#f2ecf9]">
      {/* Full professional hero with rotating people images */}
      <LandingHero />

      {/* Programs section - clean, scannable, professional */}
      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center mb-14">
          <div className="uppercase tracking-[3px] text-xs font-semibold text-[#7c3aed] mb-3">CHOOSE YOUR PATH</div>
          <h2 className="text-5xl font-semibold tracking-[-1.5px] mb-4">Programs designed for real progress</h2>
          <p className="text-xl text-[#9d8ab8]">Every program is 4 weeks. Built by coaches, for people who want results that stick.</p>
        </div>

        {(() => {
          const grouped = programs.reduce((acc: Record<string, any[]>, p: any) => {
            const c = p.category || "workout";
            (acc[c] ||= []).push(p);
            return acc;
          }, {});
          const cats = ["workout", "yoga"].filter((c) => grouped[c]?.length); // eating coming soon
          return cats.map((cat) => (
            <div key={cat} className="mb-12">
              <div className="uppercase tracking-[2px] text-xs font-semibold text-[#7c3aed] mb-2">
                {cat === "workout" ? "WORKOUT PROGRAMS" : "YOGA CHANNELS"} {/* eating coming soon */}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {grouped[cat].map((program: any) => {
                  const imgSrc = programImages[program.slug] || "/images/programs/adult.jpg";
                  return (
                    <Link
                      key={program.slug}
                      href={`/member/programs/${program.slug}`}
                      className="group block rounded-3xl overflow-hidden border border-[#3d2660] bg-[#140a22] hover:border-[#7c3aed] transition-all duration-300 hover:-translate-y-0.5"
                    >
                      <div className="relative aspect-[16/10] overflow-hidden">
                        <img 
                          src={imgSrc} 
                          alt={program.name}
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/70" />
                        <div className="absolute top-4 right-4 rounded-full bg-black/60 px-3 py-1 text-xs font-medium tracking-widest text-white/90 backdrop-blur">
                          {program.durationWeeks} WEEKS
                        </div>
                      </div>
                      
                      <div className="p-6">
                        <h3 className="text-2xl font-semibold tracking-tight mb-2 group-hover:text-[#7c3aed] transition-colors">{program.name}</h3>
                        <p className="text-[#9d8ab8] text-[15px] leading-relaxed line-clamp-3 mb-4">
                          {program.description}
                        </p>
                        <div className="inline-flex items-center text-sm font-medium text-[#7c3aed] group-hover:underline">
                          Start this program <span className="ml-1.5 text-lg leading-none transition-transform group-hover:translate-x-0.5">→</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ));
        })()}
      </div>

      {/* Trust / value section - professional and minimal */}
      <div className="border-t border-[#3d2660] bg-[#140a22]">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl mb-4 text-[#7c3aed]">01</div>
              <div className="font-semibold text-xl mb-2 tracking-tight">Built by coaches, for real people</div>
              <p className="text-[#9d8ab8] text-[15px]">Every workout and progression is designed by experienced trainers who actually coach.</p>
            </div>
            <div>
              <div className="text-4xl mb-4 text-[#7c3aed]">02</div>
              <div className="font-semibold text-xl mb-2 tracking-tight">Clear structure. Visible progress.</div>
              <p className="text-[#9d8ab8] text-[15px]">No guessing. Every day has a plan. Every week has a goal. Track it all in one place.</p>
            </div>
            <div>
              <div className="text-4xl mb-4 text-[#7c3aed]">03</div>
              <div className="font-semibold text-xl mb-2 tracking-tight">Accountability that actually works</div>
              <p className="text-[#9d8ab8] text-[15px]">Live sessions, community, and real human coaching when you need it most.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="border-t border-[#3d2660] py-16 bg-[#0a0612]">
        <div className="mx-auto max-w-xl text-center px-6">
          <h3 className="text-3xl font-semibold tracking-tight mb-4">Ready to get serious?</h3>
          <p className="text-[#9d8ab8] mb-8 text-lg">Join the platform built for people who want more than another app.</p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link href="/member" className="inline-flex h-12 items-center justify-center rounded-full bg-white px-9 text-sm font-semibold hover:bg-gray-100 transition-all hover:scale-[1.1]">
              <span style={{ color: '#7c3aed' }}>Back to your program</span>
            </Link>
            <Link href="/join/questions" className="inline-flex h-12 items-center justify-center rounded-full bg-[#7c3aed] px-9 text-sm font-semibold text-white hover:bg-[#6d2dd6] transition-all hover:scale-[1.1]">
              Join the site
            </Link>
            <Link href="/admin" className="inline-flex h-12 items-center justify-center rounded-full border border-[#3d2660] px-9 text-sm font-semibold hover:bg-white/5 transition-all hover:scale-[1.1]">
              I'm a coach
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
