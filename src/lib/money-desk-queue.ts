import "server-only";

/**
 * Money desk payment queue — what John & Jeremy see before processing payouts.
 *
 * - Connect pool lines → Stripe Transfer to partner Express accounts
 * - Company retain (Jeremy / master) → stays on platform balance (Stripe bank schedule)
 * - Platform admin fee → separate Connect transfer (not gated by $400 pool min)
 */

import { formatUsdFromCents } from "@/lib/stripe-commission";
import type { PlatformAdminFeePreview } from "@/lib/platform-admin-fee";

export type MoneyDeskQueueAction = "connect_pool" | "platform_admin" | "none";

export type MoneyDeskQueueStatus =
  | "ready"
  | "blocked"
  | "info"
  | "paid"
  | "partial";

export type MoneyDeskQueueItem = {
  id: string;
  payee: string;
  email: string | null;
  kind: "partner_pool" | "company_retain" | "platform_admin";
  kindLabel: string;
  amountCents: number;
  amountLabel: string;
  detail: string;
  status: MoneyDeskQueueStatus;
  statusLabel: string;
  /** Which process button this line uses (if any). */
  action: MoneyDeskQueueAction;
  processable: boolean;
  blockedReason: string | null;
};

export function buildMoneyDeskQueue(input: {
  projectedSplits: Array<{
    partnerId: string;
    partnerName: string;
    sharePercent: number;
    amountCents: number;
  }>;
  partners: Array<{
    id: string;
    name: string;
    email: string;
    enabled: boolean;
    connect: {
      configured: boolean;
      payoutsEnabled: boolean;
      detailsSubmitted: boolean;
    } | null;
  }>;
  companyFeed: {
    label: string;
    amountCents: number;
    sharePercent: number;
  } | null;
  payoutMinimum: {
    cents: number;
    label: string;
    met: boolean;
    shortfallLabel: string;
  };
  period: string;
  periodAlreadyPaid: boolean;
  periodPartial: boolean;
  mode: "flat" | "tiered" | "milestone";
  shareValid: boolean;
  shareMessage: string | null;
  platformAdmin: PlatformAdminFeePreview | { error: string } | null;
}): MoneyDeskQueueItem[] {
  const items: MoneyDeskQueueItem[] = [];
  const partnerById = new Map(input.partners.map((p) => [p.id, p]));

  for (const split of input.projectedSplits) {
    if (split.amountCents <= 0) continue;
    const partner = partnerById.get(split.partnerId);
    const connect = partner?.connect;
    const connectReady = Boolean(
      connect?.configured && connect.payoutsEnabled && connect.detailsSubmitted,
    );

    let status: MoneyDeskQueueStatus = "ready";
    let statusLabel = "Ready to transfer";
    let blockedReason: string | null = null;
    let processable = true;

    if (input.periodAlreadyPaid) {
      status = "paid";
      statusLabel = "Paid this period";
      processable = false;
      blockedReason = `Period ${input.period} already marked paid.`;
    } else if (input.periodPartial) {
      status = "partial";
      statusLabel = "Partial — re-run remaining";
    } else if (!partner?.enabled) {
      status = "blocked";
      statusLabel = "Partner disabled";
      processable = false;
      blockedReason = "Enable partner to include in payout.";
    } else if (!input.shareValid) {
      status = "blocked";
      statusLabel = "Shares invalid";
      processable = false;
      blockedReason = input.shareMessage || "Fix partner share %.";
    } else if (!connectReady) {
      status = "blocked";
      statusLabel = "Connect not ready";
      processable = false;
      blockedReason = "Partner must finish Stripe Connect Express (bank + identity).";
    } else if (!input.payoutMinimum.met) {
      status = "blocked";
      statusLabel = `Below ${input.payoutMinimum.label} min`;
      processable = false;
      blockedReason = `Need ${input.payoutMinimum.shortfallLabel} more in partner pool before Connect transfers.`;
    }

    items.push({
      id: `pool-${split.partnerId}`,
      payee: split.partnerName,
      email: partner?.email ?? null,
      kind: "partner_pool",
      kindLabel:
        input.mode === "flat" ? "Partner share (MRR %)" : "Partner pool (Connect)",
      amountCents: split.amountCents,
      amountLabel: formatUsdFromCents(split.amountCents),
      detail:
        input.mode === "flat"
          ? `${split.sharePercent}% of MRR · period ${input.period}`
          : `${split.sharePercent}% of fee pool · period ${input.period}`,
      status,
      statusLabel,
      action: "connect_pool",
      processable,
      blockedReason,
    });
  }

  if (input.companyFeed && input.companyFeed.amountCents > 0) {
    items.push({
      id: "company-retain",
      payee: input.companyFeed.label || "The Train Station (Jeremy)",
      email: null,
      kind: "company_retain",
      kindLabel: "Company feed (master Stripe)",
      amountCents: input.companyFeed.amountCents,
      amountLabel: formatUsdFromCents(input.companyFeed.amountCents),
      detail: `${input.companyFeed.sharePercent}% stays on Jeremy’s master Stripe → bank on Stripe’s payout schedule (no Connect transfer).`,
      status: "info",
      statusLabel: "Auto · master balance",
      action: "none",
      processable: false,
      blockedReason: null,
    });
  }

  if (input.platformAdmin) {
    if ("error" in input.platformAdmin) {
      items.push({
        id: "platform-admin",
        payee: "Platform admin (John)",
        email: null,
        kind: "platform_admin",
        kindLabel: "Platform admin fee",
        amountCents: 0,
        amountLabel: "—",
        detail: input.platformAdmin.error,
        status: "blocked",
        statusLabel: "Blocked",
        action: "platform_admin",
        processable: false,
        blockedReason: input.platformAdmin.error,
      });
    } else {
      const pa = input.platformAdmin;
      const processable = pa.connectReady;
      items.push({
        id: "platform-admin",
        payee: pa.partnerName,
        email: pa.partnerEmail,
        kind: "platform_admin",
        kindLabel: "Platform admin fee",
        amountCents: pa.amountCents,
        amountLabel: pa.amountLabel,
        detail: `${pa.description} · not gated by pool minimum`,
        status: processable ? "ready" : "blocked",
        statusLabel: processable ? "Ready to transfer" : "Connect not ready",
        action: "platform_admin",
        processable,
        blockedReason: processable
          ? null
          : `${pa.partnerName} must finish Connect Express before $275 can transfer.`,
      });
    }
  }

  return items;
}
