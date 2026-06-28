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
  paymentMethod: string | null;
  paymentNote: string | null;
  onboardingComplete: boolean;
  paidAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  completedAt: string | null;
  coachIntakeCompleteAt: string | null;
  rampStartedAt: string | null;
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
  const label = kind === "payment" && status === "none" ? "free" : status;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${colors}`}>
      {label}
    </span>
  );
}

function paymentMethodLabel(method: string | null): string {
  if (!method) return "";
  if (method === "stripe") return "Stripe";
  if (method === "venmo") return "Venmo";
  if (method === "manual") return "Manual";
  return "Other";
}

function isPaidPlan(plan: string): boolean {
  return plan === "member" || plan === "pro" || plan === "business";
}

export default function AdminMembersPage() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [intakeSigning, setIntakeSigning] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [markPaidTarget, setMarkPaidTarget] = useState<MemberRow | null>(null);
  const [markPaidMethod, setMarkPaidMethod] = useState<"venmo" | "manual" | "stripe" | "other">(
    "venmo",
  );
  const [markPaidNote, setMarkPaidNote] = useState("");
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

  async function completeIntake(userId: string) {
    setIntakeSigning(userId);
    setError("");
    const res = await fetch(`/api/admin/members/${encodeURIComponent(userId)}/intake`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Intake sign-off failed.");
    } else {
      await loadMembers();
    }
    setIntakeSigning(null);
  }

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

  async function submitMarkPaid() {
    if (!markPaidTarget) return;
    setMarkingPaid(markPaidTarget.userId);
    setError("");
    const res = await fetch(
      `/api/admin/members/${encodeURIComponent(markPaidTarget.userId)}/mark-paid`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: markPaidMethod,
          note: markPaidNote.trim() || undefined,
        }),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Mark paid failed.");
    } else {
      setMarkPaidTarget(null);
      setMarkPaidNote("");
      await loadMembers();
    }
    setMarkingPaid(null);
  }

  const pendingCount = members.filter((m) => m.approvalStatus === "pending").length;
  const intakePendingCount = members.filter(
    (m) => m.onboardingComplete && !m.coachIntakeCompleteAt,
  ).length;
  const unpaidCount = members.filter(
    (m) => isPaidPlan(m.plan) && m.paymentStatus !== "paid",
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
          <p className="text-sm text-[var(--muted)]">
            Self-registered ticket signups — approve after onboarding, mark Venmo/manual payments
            here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-center">
            <div className="text-2xl font-semibold text-accent">{pendingCount}</div>
            <div className="text-[10px] uppercase tracking-[2px] text-[var(--muted)]">
              Pending approval
            </div>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-center">
            <div className="text-2xl font-semibold text-amber-300">{unpaidCount}</div>
            <div className="text-[10px] uppercase tracking-[2px] text-[var(--muted)]">
              Awaiting payment
            </div>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-center">
            <div className="text-2xl font-semibold text-sky-300">{intakePendingCount}</div>
            <div className="text-[10px] uppercase tracking-[2px] text-[var(--muted)]">
              Needs intake
            </div>
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
                <th className="px-4 py-3 font-medium">Intake</th>
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
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {statusChip(member.paymentStatus, "payment")}
                      {member.paymentStatus === "paid" && member.paymentMethod && (
                        <span className="text-[10px] text-[var(--muted)]">
                          via {paymentMethodLabel(member.paymentMethod)}
                          {member.paidAt ? ` · ${formatWhen(member.paidAt)}` : ""}
                        </span>
                      )}
                      {member.paymentNote && (
                        <span className="text-[10px] text-[var(--muted)] italic">
                          {member.paymentNote}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {member.onboardingComplete ? "Done" : "In progress"}
                  </td>
                  <td className="px-4 py-3">
                    {member.coachIntakeCompleteAt ? (
                      <span className="text-xs text-emerald-300">
                        Done · {formatWhen(member.coachIntakeCompleteAt)}
                      </span>
                    ) : member.onboardingComplete ? (
                      <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-300">
                        Pending
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{statusChip(member.approvalStatus, "approval")}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{formatWhen(member.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-col items-end gap-1.5">
                      {isPaidPlan(member.plan) && member.paymentStatus !== "paid" && (
                        <button
                          type="button"
                          onClick={() => {
                            setMarkPaidTarget(member);
                            setMarkPaidMethod("venmo");
                            setMarkPaidNote("");
                          }}
                          disabled={markingPaid === member.userId}
                          className="btn-ghost text-xs px-3 py-1.5 ring-1 ring-emerald-500/40 text-emerald-300"
                        >
                          Mark paid
                        </button>
                      )}
                      {member.onboardingComplete && !member.coachIntakeCompleteAt ? (
                        <button
                          type="button"
                          onClick={() => void completeIntake(member.userId)}
                          disabled={intakeSigning === member.userId}
                          className="btn-ghost text-xs px-3 py-1.5 ring-1 ring-sky-500/40 text-sky-300"
                        >
                          {intakeSigning === member.userId ? "…" : "Sign off intake"}
                        </button>
                      ) : null}
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {markPaidTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md space-y-4 p-6">
            <h2 className="text-lg font-semibold">Mark paid</h2>
            <p className="text-sm text-[var(--muted)]">
              {markPaidTarget.name} · {markPaidTarget.planLabel}
            </p>
            <div>
              <label htmlFor="pay-method" className="text-xs font-medium text-[var(--muted)]">
                Payment method
              </label>
              <select
                id="pay-method"
                className="input mt-1 w-full"
                value={markPaidMethod}
                onChange={(e) =>
                  setMarkPaidMethod(e.target.value as "venmo" | "manual" | "stripe" | "other")
                }
              >
                <option value="venmo">Venmo</option>
                <option value="manual">Manual / cash</option>
                <option value="stripe">Stripe (manual confirm)</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="pay-note" className="text-xs font-medium text-[var(--muted)]">
                Note (optional)
              </label>
              <input
                id="pay-note"
                className="input mt-1 w-full"
                placeholder="e.g. Venmo @john — June signup"
                value={markPaidNote}
                onChange={(e) => setMarkPaidNote(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-ghost text-sm"
                onClick={() => setMarkPaidTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={markingPaid === markPaidTarget.userId}
                onClick={() => void submitMarkPaid()}
              >
                {markingPaid === markPaidTarget.userId ? "Saving…" : "Confirm paid"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}