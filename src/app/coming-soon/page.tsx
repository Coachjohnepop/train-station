import Link from "next/link";
import { Suspense } from "react";

function ComingSoonContent({
  searchParams,
}: {
  searchParams: { email?: string; name?: string };
}) {
  const name = searchParams.name?.trim();
  const email = searchParams.email?.trim();
  const greeting = name ? `Thanks, ${name.split(" ")[0]}.` : "You're on the list.";

  return (
    <div className="min-h-screen bg-[#0a0612] text-[#f2ecf9] flex flex-col">
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-lg text-center">
          <img src="/images/logo.png" alt="The Train Station" className="h-16 w-auto mx-auto mb-8" />

          <div className="inline-block rounded-full bg-[#7c3aed]/15 px-4 py-1 text-xs font-semibold tracking-widest text-[#7c3aed] mb-4">
            COMING SOON
          </div>

          <h1 className="text-4xl font-semibold tracking-tight mb-4">{greeting}</h1>

          <p className="text-lg text-[#9d8ab8] leading-relaxed">
            The Train Station member app is almost ready. We&apos;re rolling out access to coaches and early members first — you&apos;ll hear from us at{" "}
            {email ? (
              <span className="text-white font-medium">{email}</span>
            ) : (
              "the email you provided"
            )}{" "}
            when your spot opens up.
          </p>

          <div className="mt-8 rounded-2xl border border-[#3d2660] bg-[#140a22] p-6 text-left text-sm text-[#9d8ab8] space-y-2">
            <p className="font-medium text-white">What&apos;s launching:</p>
            <ul className="space-y-1.5">
              <li>✓ Coach-led programs with real schedules</li>
              <li>✓ SMS workouts &amp; Patreon-style coach messages</li>
              <li>✓ Set logging, streaks, and progress tracking</li>
              <li>✓ Live sessions &amp; community feeds</li>
            </ul>
          </div>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-full border border-[#3d2660] px-8 text-sm font-semibold hover:bg-white/5 transition"
            >
              Back to home
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-full bg-[#7c3aed] px-8 text-sm font-semibold text-white hover:bg-[#6d2dd6] transition"
            >
              I have early access — sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function ComingSoonPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; name?: string }>;
}) {
  const sp = await searchParams;
  return (
    <Suspense>
      <ComingSoonContent searchParams={sp} />
    </Suspense>
  );
}