import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import MemberAccountClient from "@/components/MemberAccountClient";
import UserBicepAvatar from "@/components/UserBicepAvatar";
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
      <section className="flex items-start gap-3">
        <UserBicepAvatar size={48} title={session.name || "Account"} />
        <div className="min-w-0">
          <h1 className="text-xl font-bold">Account &amp; settings</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Plan, password, notifications, billing, and tipping — all in one place.
          </p>
        </div>
      </section>
      <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading account…</p>}>
        <MemberAccountClient membership={membership} email={session.email} />
      </Suspense>
    </div>
  );
}