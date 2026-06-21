"use client";

import { useEffect, useState } from "react";
import { signupPlanLabel } from "@/lib/signup-plans";

type MemberRow = {
  userId: string;
  email: string;
  name: string;
  phone: string | null;
  plan: string;
  planLabel: string;
  approvalStatus: string;
  paymentStatus: string;
  onboardingComplete: boolean;
  paidAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  completedAt: string | null;
};

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusChip(status: string, kind: "approval" | "payment") {
  const colors =
    status === "approved" || status === "paid"
      ? "bg-emerald-500/15 text-emerald-300"
      : status === "pending"
        ? "bg-amber-500/15 text-amber-300"
        : "bg-rose-500/15 text-rose-300";
  const label =
    kind === "payment" && status === "none" ? "free" : status;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${colors}`}>
      {label}
    </span>
  );
}

export default function AdminMembersPage() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadMembers() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/members");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not load members.");
      setMembers([]);
    } else {
      setMembers(data.members || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadMembers();
  }, []);

  async function approveMember(userId: string) {
    setApproving(userId);
    setError("");
    const res = await fetch(`/api/admin/members/${encodeURIComponent(userId)}/approve`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Approve failed.");
    } else {
      await loadMembers();
    }
    setApproving(null);
  }

  const pendingCount = members.filter((m) => m.approvalStatus === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
          <p className="text-sm text-[var(--muted)]">
            Self-registered ticket signups — approve after onboarding when{" "}
            <code className="text-xs">REQUIRE_MEMBER_APPROVAL</code> is on.
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-center">
          <div className="text-2xl font-semibold text-accent">{pendingCount}</div>
          <div className="text-[10px] uppercase tracking-[2px] text-[var(--muted)]">
            Pending approval
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-amber-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading members…</p>
      ) : members.length === 0 ? (
        <div className="card py-16 text-center">
          <p className="text-sm font-medium">No self-registered members yet.</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            New signups from the ticket flow will appear here.
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-[2px] text-[var(--muted)]">
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Onboard</th>
                <th className="px-4 py-3 font-medium">Approval</th>
                <th className="px-4 py-3 font-medium">Signed up</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr
                  key={member.userId}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{member.name}</div>
                    <a
                      href={`mailto:${member.email}`}
                      className="text-xs text-accent hover:underline"
                    >
                      {member.email}
                    </a>
                    {member.phone && (
                      <div className="text-xs text-[var(--muted)]">{member.phone}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {member.planLabel || signupPlanLabel(member.plan as "explorer")}
                  </td>
                  <td className="px-4 py-3">{statusChip(member.paymentStatus, "payment")}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {member.onboardingComplete ? "Done" : "In progress"}
                  </td>
                  <td className="px-4 py-3">{statusChip(member.approvalStatus, "approval")}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{formatWhen(member.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {member.approvalStatus === "pending" && member.onboardingComplete ? (
                      <button
                        type="button"
                        onClick={() => void approveMember(member.userId)}
                        disabled={approving === member.userId}
                        className="btn-primary text-xs px-3 py-1.5"
                      >
                        {approving === member.userId ? "…" : "Approve"}
                      </button>
                    ) : member.approvalStatus === "approved" ? (
                      <span className="text-xs text-[var(--muted)]">
                        {formatWhen(member.approvedAt)}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}