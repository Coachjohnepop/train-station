import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { defaultStaffLandingPath, isStaffRole } from "@/lib/staff-access";
import SetupQuickAuthClient from "./SetupQuickAuthClient";

export const dynamic = "force-dynamic";

export default async function SetupQuickAuthPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const session = await getSessionUser();
  if (!session?.email) {
    redirect("/login?redirect=/setup-quick-auth");
  }

  const { redirect: redirectTo } = await searchParams;
  const destination =
    redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
      ? redirectTo
      : isStaffRole(session.role)
        ? defaultStaffLandingPath(session.role)
        : "/member";

  return (
    <div className="app-shell-bg flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold tracking-tight text-[var(--accent)]">
            The Train Station
          </p>
          <p className="mt-2 text-xs text-[var(--muted)]">{session.email}</p>
        </div>

        <div className="card">
          <SetupQuickAuthClient email={session.email} redirectTo={destination} />
        </div>

        <p className="mt-6 text-center text-sm">
          <Link href={destination} className="text-accent hover:underline">
            Skip for now →
          </Link>
        </p>
      </div>
    </div>
  );
}