import { notFound, redirect } from "next/navigation";
import MemberAccountClient from "@/components/MemberAccountClient";
import { getSessionUser } from "@/lib/auth";
import {
  formatMembershipPaymentStatus,
  getMemberMembershipSnapshot,
} from "@/lib/member-membership";

export const dynamic = "force-dynamic";

export default async function MemberAccountPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login?redirect=/member/account");
  if (session.role !== "MEMBER") redirect("/admin");

  const snapshot = await getMemberMembershipSnapshot(session.id);
  if (!snapshot) notFound();

  const membership = {
    ...snapshot,
    statusLabel: formatMembershipPaymentStatus(snapshot),
  };

  return (
    <div className="space-y-4">
      <section>
        <h1 className="text-xl font-bold">Account &amp; membership</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Your plan, payment status, and billing tools.
        </p>
      </section>
      <MemberAccountClient membership={membership} email={session.email} />
    </div>
  );
}