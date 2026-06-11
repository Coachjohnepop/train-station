import Link from "next/link";
import { cookies } from "next/headers";
import { MEMBER_COOKIE, MEMBER_NAME_COOKIE } from "@/lib/current-user";

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

  // First time / not yet joined: simple focused entry (no heavy 3-button splash)
  return (
    <div className="min-h-screen bg-[#0a0612] text-[#f2ecf9] flex flex-col items-center justify-center px-6">
      <div className="max-w-md text-center">
        <img src="/images/logo.png" alt="The Train Station" className="h-16 w-auto mx-auto mb-8 drop-shadow-2xl" />
        <h1 className="text-5xl font-semibold tracking-[-1.5px] mb-3">The Train Station</h1>
        <p className="text-lg text-[#9d8ab8] mb-8">Structured programs. Real accountability.<br />Results that last.</p>

        <div className="flex flex-col gap-3">
          <Link
            href="/join/questions"
            className="inline-flex h-12 items-center justify-center rounded-full bg-[#7c3aed] px-8 text-sm font-semibold text-white hover:bg-[#6d2dd6] transition-all"
          >
            Join the site
          </Link>
          <Link
            href="/member"
            className="inline-flex h-12 items-center justify-center rounded-full border border-[#3d2660] px-8 text-sm font-semibold hover:bg-white/5 transition-all"
          >
            Enter as member (demo)
          </Link>
          <Link
            href="/admin"
            className="text-xs text-[#9d8ab8] hover:text-white mt-2"
          >
            I&apos;m a coach →
          </Link>
        </div>
      </div>
      <div className="absolute bottom-6 text-[10px] text-[#9d8ab8]/50 tracking-[2px]">4-WEEK PROGRAMS • LOGGING • PROGRESS</div>
    </div>
  );
}

