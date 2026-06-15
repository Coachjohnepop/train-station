import Link from "next/link";
import { cookies } from "next/headers";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { MEMBER_COOKIE, MEMBER_NAME_COOKIE } from "@/lib/current-user";
import { resolveDemoUser } from "@/lib/demo-user-directory";
import LandingHero from "@/components/LandingHero";
import LandingWelcomeBack from "@/components/LandingWelcomeBack";

export default async function HomePage() {
  const cookieStore = await cookies();
  const session = await getSessionUser();
  const memberUid = cookieStore.get(MEMBER_COOKIE)?.value;

  if (session || memberUid) {
    const uid = session?.id || memberUid!;
    const demoUser = resolveDemoUser(uid);
    const displayName =
      session?.name ||
      demoUser?.name ||
      cookieStore.get(MEMBER_NAME_COOKIE)?.value ||
      "Member";
    const email = session?.email || demoUser?.email;
    const isCoach = session ? isStaffRole(session.role) : uid === "demo-coach-jeremy";

    return (
      <LandingWelcomeBack email={email} isCoach={isCoach}>
        <h1 className="text-6xl font-semibold tracking-[-2px] mb-4">Welcome back, {displayName}.</h1>
        <p className="text-xl text-[#9d8ab8]">Your programs, progress, and workouts are ready.</p>
      </LandingWelcomeBack>
    );
  }

  return (
    <>
      <LandingHero />

      <div className="fixed bottom-6 right-6 z-50">
        <Link
          href="/signup"
          className="group inline-flex items-center gap-2 rounded-2xl border border-[#3d2660] bg-[#0a0612]/90 px-5 py-2.5 text-sm font-semibold text-white shadow-xl backdrop-blur-md transition-all hover:border-[#7c3aed] hover:bg-[#1a1428] hover:shadow-2xl active:scale-[0.985]"
        >
          Join the waitlist
          <span className="text-[#7c3aed] transition group-hover:translate-x-0.5">→</span>
        </Link>
      </div>
    </>
  );
}