import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canAccessCoachAdmin, defaultStaffLandingPath } from "@/lib/staff-access";

export const dynamic = "force-dynamic";

/** Coaches land on My class — one screen for the gym floor. */
export default async function AdminPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login?redirect=/admin/day");
  }
  redirect(canAccessCoachAdmin(session.role) ? "/admin/day" : defaultStaffLandingPath(session.role));
}