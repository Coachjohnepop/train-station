import MemberResumeRedirect from "@/components/MemberResumeRedirect";

export const dynamic = "force-dynamic";

/** Members resume last page (Today workout, chat, etc.) or land on Today. */
export default function MemberDashboardPage() {
  return <MemberResumeRedirect />;
}