"use client";

import Link from "next/link";
import { isStandingStaffGrantEmail } from "@/lib/staff-grant-standing";
import { useEffect, useRef, useState } from "react";
import AdminMemberEquipmentModal from "@/components/AdminMemberEquipmentModal";
import AdminMemberMeasurementsModal from "@/components/AdminMemberMeasurementsModal";
import MembersSeenMarker from "@/components/MembersSeenMarker";
import {
  COACHING_MODE_LABELS,
  type MemberCoachingMode,
} from "@/lib/member-coaching-mode";
import { memberCardPath } from "@/lib/member-card-path";
import { ordinalPlace } from "@/lib/business-upgrade";
import { signupPlanLabel } from "@/lib/signup-plans";
import { formatPhoneDisplay } from "@/lib/sms-phone";

type MemberFilter =
  | "all"
  | "pending"
  | "unpaid"
  | "intake"
  | "meeting"
  | "staff_grants"
  | "upgrades";

type MemberRow = {
  userId: string;
  email: string;
  name: string;
  gender: string | null;
  primaryGoal: string | null;
  workoutSchedule: string | null;
  weightLbs: string | null;
  phone: string | null;
  plan: string;
  planLabel: string;
  approvalStatus: string;
  paymentStatus: string;
  paymentMethod: string | null;
  paymentNote: string | null;
  staffGrantExpiresAt: string | null;
  staffGrantedAt: string | null;
  staffGrantedBy: string | null;
  onboardingComplete: boolean;
  paidAt: string | null;
  lastPaymentAmountCents?: number | null;
  lastPaymentCurrency?: string | null;
  lastPaymentAt?: string | null;
  lastPaymentLabel?: string | null;
  approvedAt: string | null;
  createdAt: string;
  completedAt: string | null;
  coachIntakeCompleteAt: string | null;
  calorieThresholdsReady?: boolean;
  introBookedAt: string | null;
  coachMeetingRequestedAt: string | null;
  coachMeetingRequestNote: string | null;
  rampStartedAt: string | null;
  businessUpgradeRequestedAt: string | null;
  businessUpgradeStatus: string | null;
  businessUpgradeReviewedAt: string | null;
  businessUpgradeReviewedBy: string | null;
  businessUpgradeQueuePosition: number | null;
  businessUpgradeQueueSize: number | null;
  hasStripeSubscription: boolean;
  coachingMode: MemberCoachingMode;
};

type PaymentHistoryRow = {
  id: string;
  amountLabel: string;
  status: string;
  planId: string | null;
  billingReason: string | null;
  paidAt: string;
  memberName?: string | null;
};

function isStaffGrantRow(m: MemberRow): boolean {
  return (
    m.paymentMethod === "manual" &&
    Boolean(m.staffGrantedAt || m.staffGrantExpiresAt || (m.paymentNote || "").toLowerCase().includes("staff grant"))
  );
}

function staffGrantNeedsReapprove(m: MemberRow): boolean {
  if (isStandingStaffGrantEmail(m.email)) return false;
  if (!isStaffGrantRow(m)) return false;
  if (m.paymentStatus !== "paid") return true;
  if (!m.staffGrantExpiresAt) return false;
  return new Date(m.staffGrantExpiresAt).getTime() <= Date.now();
}

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
  const [meetingRequesting, setMeetingRequesting] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [markPaidTarget, setMarkPaidTarget] = useState<MemberRow | null>(null);
  const [markPaidMethod, setMarkPaidMethod] = useState<"manual" | "other">("manual");
  const [markPaidNote, setMarkPaidNote] = useState("");
  const [markPaidAmount, setMarkPaidAmount] = useState("25");
  const [paymentsTarget, setPaymentsTarget] = useState<MemberRow | null>(null);
  const [paymentsRows, setPaymentsRows] = useState<PaymentHistoryRow[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsTotal, setPaymentsTotal] = useState<string | null>(null);
  const [staffGrantTarget, setStaffGrantTarget] = useState<MemberRow | null>(null);
  const [staffGrantPlan, setStaffGrantPlan] = useState<"member" | "business" | "pro">("member");
  const [staffGrantNote, setStaffGrantNote] = useState("");
  const [staffGranting, setStaffGranting] = useState<string | null>(null);
  const [upgradeActing, setUpgradeActing] = useState<string | null>(null);
  const [promoDrawing, setPromoDrawing] = useState(false);
  const [promo, setPromo] = useState<{
    current: {
      monthKey: string;
      monthLabel: string;
      eligibleCount: number;
      drawn: boolean;
      winnerEmail: string | null;
    };
    previous: {
      monthKey: string;
      monthLabel: string;
      eligibleCount: number;
      drawn: boolean;
      winnerEmail: string | null;
    };
  } | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<MemberFilter>("all");
  const listRef = useRef<HTMLDivElement | null>(null);

  function snapToFilter(next: MemberFilter) {
    setFilter((current) => (current === next ? "all" : next));
    window.requestAnimationFrame(() => {
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  const [removing, setRemoving] = useState<string | null>(null);
  const [savingMode, setSavingMode] = useState<string | null>(null);
  const [equipmentTarget, setEquipmentTarget] = useState<MemberRow | null>(null);
  const [measurementsTarget, setMeasurementsTarget] = useState<MemberRow | null>(null);

  async function loadMembers() {
    setLoading(true);
    setError("");
    const [res, promoRes] = await Promise.all([
      fetch("/api/admin/members"),
      fetch("/api/admin/members/business-upgrade-promo"),
    ]);
    const data = await res.json().catch(() => ({}));
    const promoData = await promoRes.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not load members.");
      setMembers([]);
    } else {
      setMembers(data.members || []);
    }
    if (promoRes.ok && promoData.current && promoData.previous) {
      setPromo({ current: promoData.current, previous: promoData.previous });
    }
    setLoading(false);
  }

  async function drawMonthlyPromo(monthKey: string) {
    if (
      !window.confirm(
        `Draw one lucky paying Coach Class upgrade request for ${monthKey}? They get complimentary Business Class (Coach billing stays).`,
      )
    ) {
      return;
    }
    setPromoDrawing(true);
    setError("");
    const res = await fetch("/api/admin/members/business-upgrade-promo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthKey }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not draw the monthly promo.");
    } else {
      await loadMembers();
    }
    setPromoDrawing(false);
  }

  useEffect(() => {
    void loadMembers();
  }, []);

  async function requestMeeting(userId: string) {
    const note =
      window.prompt("Optional note for the member (e.g. 6-month check-in):", "Follow-up call")?.trim() ||
      "Follow-up call";
    if (note === null) return;

    setMeetingRequesting(userId);
    setError("");
    const res = await fetch(`/api/admin/members/${encodeURIComponent(userId)}/meeting-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not request meeting.");
    } else {
      await loadMembers();
    }
    setMeetingRequesting(null);
  }

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
    const dollars = Number(markPaidAmount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError("Enter a payment amount in dollars (e.g. 25).");
      return;
    }
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
          amountDollars: dollars,
        }),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Mark paid failed.");
    } else {
      setMarkPaidTarget(null);
      setMarkPaidNote("");
      setMarkPaidAmount("25");
      await loadMembers();
    }
    setMarkingPaid(null);
  }

  async function openPaymentHistory(member: MemberRow) {
    setPaymentsTarget(member);
    setPaymentsLoading(true);
    setPaymentsRows([]);
    setPaymentsTotal(null);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/members/${encodeURIComponent(member.userId)}/payments`,
        { cache: "no-store" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not load payment history.");
      } else {
        setPaymentsRows(data.rows || []);
        setPaymentsTotal(data.totalPaidLabel || null);
      }
    } catch {
      setError("Could not load payment history.");
    } finally {
      setPaymentsLoading(false);
    }
  }

  async function submitStaffGrant() {
    if (!staffGrantTarget) return;
    setStaffGranting(staffGrantTarget.userId);
    setError("");
    const res = await fetch(
      `/api/admin/members/${encodeURIComponent(staffGrantTarget.userId)}/staff-grant`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: staffGrantPlan,
          note: staffGrantNote.trim() || undefined,
          completeOnboarding: true,
        }),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Staff grant failed.");
    } else {
      setStaffGrantTarget(null);
      setStaffGrantNote("");
      await loadMembers();
    }
    setStaffGranting(null);
  }

  async function reviewBusinessUpgrade(member: MemberRow, action: "approve" | "decline") {
    const verb = action === "approve" ? "Approve" : "Decline";
    const stripeBit =
      action === "approve"
        ? "Complimentary Business Class. Their Stripe price does not change. Buying Business Class at checkout is still $50/mo."
        : "They stay on Coach Class and can request again.";
    if (
      !window.confirm(
        `${verb} Business Class upgrade for ${member.name} (${member.email})?\n\n${stripeBit}`,
      )
    ) {
      return;
    }
    setUpgradeActing(`${member.userId}:${action}`);
    setError("");
    const res = await fetch(
      `/api/admin/members/${encodeURIComponent(member.userId)}/business-upgrade`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || `Could not ${action} the upgrade.`);
    } else {
      await loadMembers();
    }
    setUpgradeActing(null);
  }

  function matchesFilter(member: MemberRow): boolean {
    switch (filter) {
      case "pending":
        return member.approvalStatus === "pending" && member.onboardingComplete;
      case "unpaid":
        return isPaidPlan(member.plan) && member.paymentStatus !== "paid";
      case "intake":
        return member.onboardingComplete && !member.coachIntakeCompleteAt;
      case "meeting":
        return Boolean(member.coachMeetingRequestedAt);
      case "staff_grants":
        return isStaffGrantRow(member);
      case "upgrades":
        return member.businessUpgradeStatus === "pending";
      default:
        return true;
    }
  }

  async function updateCoachingMode(userId: string, coachingMode: MemberCoachingMode) {
    setSavingMode(userId);
    setError("");
    const res = await fetch(`/api/admin/members/${encodeURIComponent(userId)}/coach-prefs`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coachingMode }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not save coaching mode.");
    } else {
      setMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, coachingMode } : m)),
      );
    }
    setSavingMode(null);
  }

  async function removeMember(member: MemberRow) {
    if (
      !window.confirm(
        `Remove ${member.name} (${member.email})? They can sign up again with the same email.`,
      )
    ) {
      return;
    }
    setRemoving(member.userId);
    setError("");
    const res = await fetch("/api/admin/members/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: member.email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not remove member.");
    } else {
      await loadMembers();
    }
    setRemoving(null);
  }

  const pendingCount = members.filter(
    (m) => m.approvalStatus === "pending" && m.onboardingComplete,
  ).length;
  const intakePendingCount = members.filter(
    (m) => m.onboardingComplete && !m.coachIntakeCompleteAt,
  ).length;
  const unpaidCount = members.filter(
    (m) => isPaidPlan(m.plan) && m.paymentStatus !== "paid",
  ).length;
  const meetingCount = members.filter((m) => m.coachMeetingRequestedAt).length;
  const staffGrantCount = members.filter(isStaffGrantRow).length;
  const staffReapproveCount = members.filter(staffGrantNeedsReapprove).length;
  const upgradeRequestCount = members.filter((m) => m.businessUpgradeStatus === "pending").length;
  const visibleMembers = members
    .filter(matchesFilter)
    .slice()
    .sort((a, b) => {
      if (filter !== "upgrades") return 0;
      const ap = a.businessUpgradeQueuePosition ?? Number.MAX_SAFE_INTEGER;
      const bp = b.businessUpgradeQueuePosition ?? Number.MAX_SAFE_INTEGER;
      return ap - bp;
    });

  const filterButtons: { id: MemberFilter; label: string; count?: number }[] = [
    { id: "all", label: "All" },
    { id: "pending", label: "Pending", count: pendingCount },
    { id: "unpaid", label: "Unpaid", count: unpaidCount },
    { id: "staff_grants", label: "Staff grants", count: staffGrantCount },
    { id: "upgrades", label: "Upgrades", count: upgradeRequestCount },
    { id: "intake", label: "Intake", count: intakePendingCount },
    { id: "meeting", label: "Meetings", count: meetingCount },
  ];

  return (
    <div className="space-y-6">
      <MembersSeenMarker />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
          <p className="text-sm text-[var(--muted)]">
            Self-registered ticket signups — open a{" "}
            <strong className="font-semibold text-[var(--text)]">member card</strong> during the
            15-minute intro to capture phone, goals, calorie thresholds, and notes. Approve, mark
            paid, or{" "}
            <strong className="font-semibold text-[var(--text)]">Staff grant</strong> a tier
            (Coach / Business / 1st Class) without Stripe. Staff grants need reapproval each{" "}
            <strong className="font-semibold text-[var(--text)]">1st of the month</strong> (you +
            Jeremy get email).
            {staffReapproveCount > 0 ? (
              <span className="ml-1 font-semibold text-amber-300">
                {staffReapproveCount} need reapproval.
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              {
                id: "pending" as const,
                count: pendingCount,
                label: "Pending approval",
                countClass: "text-accent",
              },
              {
                id: "unpaid" as const,
                count: unpaidCount,
                label: "Awaiting payment",
                countClass: "text-amber-300",
              },
              {
                id: "intake" as const,
                count: intakePendingCount,
                label: "Needs intake",
                countClass: "text-sky-300",
              },
              {
                id: "upgrades" as const,
                count: upgradeRequestCount,
                label: "Upgrade requests",
                countClass: "text-amber-200",
              },
            ] as const
          ).map((card) => {
            const active = filter === card.id;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => snapToFilter(card.id)}
                aria-pressed={active}
                className={`min-w-[7.5rem] rounded-lg border px-4 py-2 text-center transition ${
                  active
                    ? "border-accent bg-accent/15 ring-1 ring-accent/40"
                    : "border-[var(--border)] bg-[var(--surface-2)] hover:border-accent/50 hover:bg-[var(--surface)]"
                }`}
              >
                <div className={`text-2xl font-semibold ${card.countClass}`}>{card.count}</div>
                <div className="text-[10px] uppercase tracking-[2px] text-[var(--muted)]">
                  {card.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {filterButtons.map((btn) => (
          <button
            key={btn.id}
            type="button"
            onClick={() => snapToFilter(btn.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              filter === btn.id
                ? "nav-tab-active text-accent"
                : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            {btn.label}
            {btn.count != null && btn.count > 0 ? ` (${btn.count})` : ""}
          </button>
        ))}
      </div>

      {promo ? (
        <div className="rounded-xl border border-accent/30 bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface))] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
            Monthly upgrade promo
          </p>
          <p className="mt-1 text-sm text-[var(--text)]">
            {promo.current.monthLabel}: {promo.current.eligibleCount} paying Coach Class request
            {promo.current.eligibleCount === 1 ? "" : "s"} in the drawing
            {promo.current.drawn
              ? promo.current.winnerEmail
                ? ` · winner ${promo.current.winnerEmail}`
                : " · drawn, no paying requests"
              : " · one complimentary Business Class seat at month end"}
            .
          </p>
          {promo.previous.drawn && promo.previous.winnerEmail ? (
            <p className="mt-1 text-xs text-[var(--muted)]">
              {promo.previous.monthLabel} winner: {promo.previous.winnerEmail}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {!promo.current.drawn ? (
              <button
                type="button"
                className="btn-primary text-xs px-3 py-1.5"
                disabled={promoDrawing}
                onClick={() => void drawMonthlyPromo(promo.current.monthKey)}
              >
                {promoDrawing ? "Drawing…" : `Draw ${promo.current.monthLabel} winner`}
              </button>
            ) : null}
            {!promo.previous.drawn && promo.previous.eligibleCount > 0 ? (
              <button
                type="button"
                className="btn-ghost text-xs px-3 py-1.5 ring-1 ring-accent/30"
                disabled={promoDrawing}
                onClick={() => void drawMonthlyPromo(promo.previous.monthKey)}
              >
                {promoDrawing ? "Drawing…" : `Draw ${promo.previous.monthLabel} winner`}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {error && <p className="text-sm text-amber-400">{error}</p>}

      <div ref={listRef}>
      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading members…</p>
      ) : visibleMembers.length === 0 ? (
        <div className="card py-16 text-center">
          <p className="text-sm font-medium">
            {members.length === 0 ? "No self-registered members yet." : "No members in this filter."}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {members.length === 0
              ? "New signups from the ticket flow will appear here."
              : "Try another filter or clear the selection above."}
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
                <th className="px-4 py-3 font-medium">Coaching</th>
                <th className="px-4 py-3 font-medium">Signed up</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {visibleMembers.map((member) => (
                <tr
                  key={member.userId}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      <Link
                        href={memberCardPath(member.userId)}
                        className="hover:text-accent hover:underline"
                      >
                        {member.name}
                      </Link>
                    </div>
                    {member.gender ? (
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                        {member.gender}
                        {member.weightLbs ? ` · ${member.weightLbs} lb` : ""}
                      </div>
                    ) : null}
                    {member.primaryGoal || member.workoutSchedule ? (
                      <div className="text-[11px] text-[var(--muted)]">
                        {[member.primaryGoal, member.workoutSchedule]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    ) : null}
                    <a
                      href={`mailto:${member.email}`}
                      className="text-xs text-accent hover:underline"
                    >
                      {member.email}
                    </a>
                    {member.phone && (
                      <div className="text-xs text-[var(--muted)]">
                        {formatPhoneDisplay(member.phone)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    <div>{member.planLabel || signupPlanLabel(member.plan as "explorer")}</div>
                    {member.businessUpgradeStatus === "pending" ? (
                      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                        {member.businessUpgradeQueuePosition
                          ? `${ordinalPlace(member.businessUpgradeQueuePosition)} of ${member.businessUpgradeQueueSize ?? "?"} on upgrade list`
                          : "Business upgrade requested"}
                        {member.businessUpgradeRequestedAt
                          ? ` · ${formatWhen(member.businessUpgradeRequestedAt)}`
                          : ""}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {statusChip(member.paymentStatus, "payment")}
                      {member.paymentStatus === "paid" && member.paymentMethod && (
                        <span className="text-[10px] text-[var(--muted)]">
                          via{" "}
                          {isStaffGrantRow(member)
                            ? "Staff grant"
                            : paymentMethodLabel(member.paymentMethod)}
                          {member.paidAt ? ` · ${formatWhen(member.paidAt)}` : ""}
                        </span>
                      )}
                      {member.lastPaymentLabel ? (
                        <button
                          type="button"
                          className="text-left text-[10px] font-semibold text-accent hover:underline"
                          onClick={() => void openPaymentHistory(member)}
                        >
                          Last: {member.lastPaymentLabel}
                          {member.lastPaymentAt
                            ? ` · ${formatWhen(member.lastPaymentAt)}`
                            : ""}{" "}
                          · history
                        </button>
                      ) : member.paymentStatus === "paid" ? (
                        <button
                          type="button"
                          className="text-left text-[10px] text-[var(--muted)] hover:text-accent hover:underline"
                          onClick={() => void openPaymentHistory(member)}
                        >
                          Payment history
                        </button>
                      ) : null}
                      {isStaffGrantRow(member) && member.staffGrantExpiresAt ? (
                        <span
                          className={`text-[10px] font-semibold ${
                            staffGrantNeedsReapprove(member)
                              ? "text-amber-300"
                              : "text-violet-300"
                          }`}
                        >
                          {isStandingStaffGrantEmail(member.email)
                            ? "Standing · "
                            : staffGrantNeedsReapprove(member)
                              ? "Reapprove by "
                              : "Until "}
                          {formatWhen(member.staffGrantExpiresAt)}
                        </span>
                      ) : null}
                      {member.paymentNote && (
                        <span className="max-w-[12rem] text-[10px] text-[var(--muted)] italic line-clamp-2">
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
                  <td className="px-4 py-3">
                    <select
                      className="input text-xs py-1.5 min-w-[6.5rem]"
                      value={member.coachingMode}
                      disabled={savingMode === member.userId}
                      onChange={(e) =>
                        void updateCoachingMode(
                          member.userId,
                          e.target.value as MemberCoachingMode,
                        )
                      }
                    >
                      {(Object.keys(COACHING_MODE_LABELS) as MemberCoachingMode[]).map((mode) => (
                        <option key={mode} value={mode}>
                          {COACHING_MODE_LABELS[mode]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{formatWhen(member.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-col items-end gap-1.5">
                      <Link
                        href={memberCardPath(member.userId)}
                        className="btn-ghost text-xs px-3 py-1.5 ring-1 ring-[color-mix(in_srgb,var(--ramp-gold)_50%,transparent)] text-[var(--ramp-gold-light)]"
                      >
                        Member card
                      </Link>
                      <Link
                        href={`/admin/chat?member=${encodeURIComponent(member.userId)}`}
                        className="btn-ghost text-xs px-3 py-1.5 ring-1 ring-accent/30 text-accent"
                      >
                        Message
                      </Link>
                      <button
                        type="button"
                        onClick={() => setEquipmentTarget(member)}
                        className="btn-ghost text-xs px-3 py-1.5 ring-1 ring-sky-500/30 text-sky-300"
                      >
                        Equipment
                      </button>
                      <button
                        type="button"
                        onClick={() => setMeasurementsTarget(member)}
                        className="btn-ghost text-xs px-3 py-1.5 ring-1 ring-fuchsia-500/30 text-fuchsia-300"
                      >
                        Measurements
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setStaffGrantTarget(member);
                          setStaffGrantPlan(
                            isPaidPlan(member.plan)
                              ? (member.plan as "member" | "business" | "pro")
                              : "member",
                          );
                          setStaffGrantNote("");
                        }}
                        disabled={staffGranting === member.userId}
                        className={`btn-ghost text-xs px-3 py-1.5 ring-1 ${
                          staffGrantNeedsReapprove(member)
                            ? "ring-amber-500/50 text-amber-300"
                            : "ring-violet-500/40 text-violet-300"
                        }`}
                      >
                        {staffGrantNeedsReapprove(member)
                          ? "Reapprove grant"
                          : isStaffGrantRow(member)
                            ? "Extend grant"
                            : "Staff grant"}
                      </button>
                      {isPaidPlan(member.plan) && member.paymentStatus !== "paid" && (
                        <button
                          type="button"
                          onClick={() => {
                            setMarkPaidTarget(member);
                            setMarkPaidMethod("manual");
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
                          disabled={intakeSigning === member.userId || !member.calorieThresholdsReady}
                          title={
                            member.calorieThresholdsReady
                              ? "Sign off the 15-minute intro"
                              : "Open the member card and set calorie thresholds first"
                          }
                          className="btn-ghost text-xs px-3 py-1.5 ring-1 ring-sky-500/40 text-sky-300 disabled:opacity-50"
                        >
                          {intakeSigning === member.userId ? "…" : "Sign off intake"}
                        </button>
                      ) : null}
                      {member.onboardingComplete ? (
                        <button
                          type="button"
                          onClick={() => void requestMeeting(member.userId)}
                          disabled={meetingRequesting === member.userId}
                          className="btn-ghost text-xs px-3 py-1.5 ring-1 ring-[color-mix(in_srgb,var(--ramp-gold)_55%,transparent)] text-[var(--ramp-gold-light)]"
                        >
                          {meetingRequesting === member.userId
                            ? "…"
                            : member.coachMeetingRequestedAt
                              ? "Re-request meeting"
                              : "Request meeting"}
                        </button>
                      ) : null}
                      {member.businessUpgradeStatus === "pending" ? (
                        <div className="flex flex-col items-end gap-1">
                          <button
                            type="button"
                            onClick={() => void reviewBusinessUpgrade(member, "approve")}
                            disabled={upgradeActing === `${member.userId}:approve`}
                            className="btn-primary text-xs px-3 py-1.5"
                          >
                            {upgradeActing === `${member.userId}:approve` ? "…" : "Approve upgrade"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void reviewBusinessUpgrade(member, "decline")}
                            disabled={upgradeActing === `${member.userId}:decline`}
                            className="btn-ghost text-xs px-3 py-1.5 ring-1 ring-rose-500/30 text-rose-300"
                          >
                            {upgradeActing === `${member.userId}:decline` ? "…" : "Decline upgrade"}
                          </button>
                        </div>
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
                      <button
                        type="button"
                        onClick={() => void removeMember(member)}
                        disabled={removing === member.userId}
                        className="btn-ghost text-xs px-3 py-1.5 text-rose-300 ring-1 ring-rose-500/30"
                      >
                        {removing === member.userId ? "…" : "Remove"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>

      {equipmentTarget && (
        <AdminMemberEquipmentModal
          userId={equipmentTarget.userId}
          memberName={equipmentTarget.name}
          onClose={() => setEquipmentTarget(null)}
        />
      )}

      {measurementsTarget && (
        <AdminMemberMeasurementsModal
          userId={measurementsTarget.userId}
          memberName={measurementsTarget.name}
          onClose={() => setMeasurementsTarget(null)}
        />
      )}

      {markPaidTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md space-y-4 p-6">
            <h2 className="text-lg font-semibold">Mark paid</h2>
            <p className="text-sm text-[var(--muted)]">
              {markPaidTarget.name} · {markPaidTarget.planLabel}
            </p>
            <p className="text-xs text-[var(--muted)]">
              Amount is required so Accounting books stay complete (cash / other). Memberships collect on Stripe.
            </p>
            <div>
              <label htmlFor="pay-amount" className="text-xs font-medium text-[var(--muted)]">
                Amount received (USD) *
              </label>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">
                  $
                </span>
                <input
                  id="pay-amount"
                  type="number"
                  min={0.01}
                  step={0.01}
                  inputMode="decimal"
                  className="input w-full pl-7"
                  placeholder="25.00"
                  value={markPaidAmount}
                  onChange={(e) => setMarkPaidAmount(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label htmlFor="pay-method" className="text-xs font-medium text-[var(--muted)]">
                Payment method
              </label>
              <select
                id="pay-method"
                className="input mt-1 w-full"
                value={markPaidMethod}
                onChange={(e) =>
                  setMarkPaidMethod(e.target.value as "manual" | "other")
                }
              >
                <option value="manual">Manual / cash</option>
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
                placeholder="e.g. cash at the gym — June signup"
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

      {paymentsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card max-h-[85vh] w-full max-w-lg space-y-4 overflow-y-auto p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Payment history</h2>
                <p className="text-sm text-[var(--muted)]">
                  {paymentsTarget.name} · {paymentsTarget.email}
                </p>
                {paymentsTotal ? (
                  <p className="mt-1 text-sm font-semibold text-emerald-300">
                    Recorded total: {paymentsTotal}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="btn-ghost text-sm"
                onClick={() => setPaymentsTarget(null)}
              >
                Close
              </button>
            </div>
            {paymentsLoading ? (
              <p className="text-sm text-[var(--muted)]">Loading…</p>
            ) : paymentsRows.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No ledger rows yet. Stripe checkouts after the ledger fix, or Mark paid with an
                amount, will show here.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
                {paymentsRows.map((row) => (
                  <li key={row.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                    <div>
                      <p className="font-semibold tabular-nums">{row.amountLabel}</p>
                      <p className="text-[11px] text-[var(--muted)]">
                        {row.billingReason || row.planId || "payment"} · {row.status}
                      </p>
                    </div>
                    <p className="shrink-0 text-[11px] text-[var(--muted)]">
                      {formatWhen(row.paidAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-[var(--muted)]">
              Source: app books (Postgres). Full desk:{" "}
              <Link href="/admin/accounting" className="text-accent hover:underline">
                Accounting
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      {staffGrantTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md space-y-4 p-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-300">
                Manual staff grant
              </p>
              <h2 className="mt-1 text-lg font-semibold">Grant membership</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {staffGrantTarget.name} · {staffGrantTarget.email}
              </p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Sets tier + paid (manual) without Stripe through the <strong>1st of next month</strong>.
                John + Jeremy get email on grant / reapprove / expire. Coach Class = grey Maintain;
                Business+ = full Quick maintain.
              </p>
            </div>
            <div>
              <label htmlFor="staff-plan" className="text-xs font-medium text-[var(--muted)]">
                Plan
              </label>
              <select
                id="staff-plan"
                className="input mt-1 w-full"
                value={staffGrantPlan}
                onChange={(e) =>
                  setStaffGrantPlan(e.target.value as "member" | "business" | "pro")
                }
              >
                <option value="member">Coach Class</option>
                <option value="business">Business Class</option>
                <option value="pro">1st Class</option>
              </select>
            </div>
            <div>
              <label htmlFor="staff-note" className="text-xs font-medium text-[var(--muted)]">
                Note (optional)
              </label>
              <input
                id="staff-note"
                className="input mt-1 w-full"
                placeholder="e.g. Beta · family · pending Stripe discount test"
                value={staffGrantNote}
                onChange={(e) => setStaffGrantNote(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-ghost text-sm"
                onClick={() => setStaffGrantTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={staffGranting === staffGrantTarget.userId}
                onClick={() => void submitStaffGrant()}
              >
                {staffGranting === staffGrantTarget.userId ? "Saving…" : "Grant access"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}