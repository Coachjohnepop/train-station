import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Members land on Today — avoids client redirect hop that can fail on mobile Safari. */
export default function MemberDashboardPage() {
  redirect("/member/today");
}