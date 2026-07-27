import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Insights renamed → Site Analytics */
export default function AdminInsightsRedirectPage() {
  redirect("/admin/analytics");
}
