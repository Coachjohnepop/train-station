import Link from "next/link";
import { cookies } from "next/headers";
import { MEMBER_COOKIE, MEMBER_NAME_COOKIE } from "@/lib/current-user";
import LandingHero from "@/components/LandingHero";

export default async function HomePage() {
  const cookieStore = await cookies();
  const hasJoined = !!cookieStore.get(MEMBER_COOKIE)?.value;
  const joinedName = cookieStore.get(MEMBER_NAME_COOKIE)?.value || "Member";

  if (hasJoined) {
    // Returning joined user: single prominent "Back to the Program" – no 3 buttons.
    return (
      <div className="min-h-screen bg-[#0a0612] text-[#f2ecf9] flex flex-col">
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-xl text-center">
            <div className="mx-auto mb-8">
              <img src="/images/logo.png" alt="The Train Station" className="h-20 w-auto mx-auto drop-shadow-2xl" />
            </div>
            <h1 className="text-6xl font-semibold tracking-[-2px] mb-4">Welcome back, {joinedName.split(" ")[0]}.</h1>
            <p className="text-xl text-[#9d8ab8] mb-10">Your programs, progress, and workouts are ready.</p>

            <Link
              href="/member"
              className="inline-flex h-14 items-center justify-center rounded-full bg-white px-12 text-base font-semibold transition-all hover:bg-gray-100 hover:scale-[1.02] active:scale-[0.985]"
            >
              <span style={{ color: "#7c3aed" }}>Back to the Program</span>
            </Link>

            <div className="mt-8 text-xs text-[#9d8ab8]/70 tracking-widest">
              THE TRAIN STATION — YOUR TRAINING HUB
            </div>
          </div>
        </div>

        <div className="border-t border-[#3d2660] py-6 text-center text-xs text-[#9d8ab8]">
          <Link href="/admin" className="hover:text-white transition mx-3">Coach / Admin</Link>
          <span className="mx-1">·</span>
          <Link href="/join" className="hover:text-white transition mx-3">Join another account</Link>
        </div>
      </div>
    );
  }

  // First time / not yet joined: use the scrolling hero with the 4 people graphics.
  // "Enter as a Member" is the prominent top button.
  // "Explore the site" leads into the member layout (programs + info) to encourage sign up.
  // The "Join the site" is the classy fixed bottom-right pane button, always visible until signed up.
  return (
    <>
      <LandingHero />

      {/* Classy fixed bottom-right "Join the site" pane/button - visible always on landing until signup */}
      <div className="fixed bottom-6 right-6 z-50">
        <Link
          href="/join/questions"
          className="group inline-flex items-center gap-2 rounded-2xl border border-[#3d2660] bg-[#0a0612]/90 px-5 py-2.5 text-sm font-semibold text-white shadow-xl backdrop-blur-md transition-all hover:border-[#7c3aed] hover:bg-[#1a1428] hover:shadow-2xl active:scale-[0.985]"
        >
          Join the site
          <span className="text-[#7c3aed] transition group-hover:translate-x-0.5">→</span>
        </Link>
      </div>
    </>
  );
}

