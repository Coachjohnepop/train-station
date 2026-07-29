import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { resolveLoginDestination } from "@/lib/complete-login";
import { memberTodayPath } from "@/lib/member-destinations";

export const dynamic = "force-dynamic";

/**
 * /member entry — route from real profile state (onboard / checkout / today),
 * not a blind hop to Today. Incomplete free Explorer must hit the wizard first.
 */
export default async function MemberDashboardPage() {
  const session = await getSessionUser();
  if (session?.role === "MEMBER") {
    redirect(await resolveLoginDestination(session));
  }
  redirect(memberTodayPath());
}
