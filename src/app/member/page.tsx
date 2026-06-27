import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Members land on Today — workout, coach comms, and enrolled program window. */
export default function MemberDashboardPage() {
  redirect("/member/today");
}