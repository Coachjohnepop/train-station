/**
 * Default Train Station chart of accounts (QuickBooks-style).
 * Codes are system-stable — UI can rename labels but keep codes for posting rules.
 */
import type { AcctAccountType, AcctNormalBalance } from "@/generated/prisma/client";

export const DEFAULT_ENTITY_CODE = "train-station";
export const DEFAULT_ENTITY_NAME = "The Train Station";

export type SeedAccountDef = {
  code: string;
  name: string;
  type: AcctAccountType;
  subtype: string;
  normalBalance: AcctNormalBalance;
  description: string;
  sortOrder: number;
};

export const SYSTEM_CHART: SeedAccountDef[] = [
  {
    code: "1000",
    name: "Cash — Stripe (bank)",
    type: "ASSET",
    subtype: "bank",
    normalBalance: "DEBIT",
    description:
      "Primary cash account for now: Stripe is the bank. Card settlements in the merchant balance.",
    sortOrder: 100,
  },
  {
    code: "1010",
    name: "Cash — Venmo / undeposited",
    type: "ASSET",
    subtype: "bank",
    normalBalance: "DEBIT",
    description: "Venmo and cash received outside Stripe until treated as banked.",
    sortOrder: 110,
  },
  {
    code: "1100",
    name: "Accounts receivable",
    type: "ASSET",
    subtype: "ar",
    normalBalance: "DEBIT",
    description: "Amounts members owe (future invoices).",
    sortOrder: 200,
  },
  {
    code: "1200",
    name: "Stripe fees receivable / adjustments",
    type: "ASSET",
    subtype: "other_current",
    normalBalance: "DEBIT",
    description: "Rare fee credits / disputes clearing.",
    sortOrder: 210,
  },
  {
    code: "2000",
    name: "Deferred membership revenue",
    type: "LIABILITY",
    subtype: "deferred_revenue",
    normalBalance: "CREDIT",
    description: "Prepaid periods not yet earned (future).",
    sortOrder: 300,
  },
  {
    code: "2100",
    name: "Partner fee pool payable",
    type: "LIABILITY",
    subtype: "payable",
    normalBalance: "CREDIT",
    description: "Dev & partnership fee pool before Connect payout.",
    sortOrder: 310,
  },
  {
    code: "2200",
    name: "Sales tax payable",
    type: "LIABILITY",
    subtype: "tax",
    normalBalance: "CREDIT",
    description: "Reserved if tax ever applies.",
    sortOrder: 320,
  },
  {
    code: "3000",
    name: "Owner equity",
    type: "EQUITY",
    subtype: "equity",
    normalBalance: "CREDIT",
    description: "Opening equity / retained earnings parent.",
    sortOrder: 400,
  },
  {
    code: "3100",
    name: "Retained earnings",
    type: "EQUITY",
    subtype: "retained_earnings",
    normalBalance: "CREDIT",
    description: "Closed P&L rolls here.",
    sortOrder: 410,
  },
  {
    code: "4000",
    name: "Membership revenue",
    type: "REVENUE",
    subtype: "membership",
    normalBalance: "CREDIT",
    description: "Coach / Business / 1st Class ticket revenue.",
    sortOrder: 500,
  },
  {
    code: "4010",
    name: "Tips revenue",
    type: "REVENUE",
    subtype: "tips",
    normalBalance: "CREDIT",
    description: "Coach tips collected via Stripe.",
    sortOrder: 510,
  },
  {
    code: "4020",
    name: "Merchandise / other revenue",
    type: "REVENUE",
    subtype: "other",
    normalBalance: "CREDIT",
    description: "Merch and one-off non-membership sales.",
    sortOrder: 520,
  },
  {
    code: "5000",
    name: "Stripe processing fees",
    type: "EXPENSE",
    subtype: "payment_fees",
    normalBalance: "DEBIT",
    description: "Card network + Stripe fees.",
    sortOrder: 600,
  },
  {
    code: "5100",
    name: "Platform / partnership fees",
    type: "EXPENSE",
    subtype: "platform",
    normalBalance: "DEBIT",
    description: "Dev & partnership fee expense side of pool.",
    sortOrder: 610,
  },
  {
    code: "5200",
    name: "Refunds & chargebacks",
    type: "EXPENSE",
    subtype: "refunds",
    normalBalance: "DEBIT",
    description: "Contra revenue style expense for refunds.",
    sortOrder: 620,
  },
  {
    code: "6000",
    name: "Operating expenses",
    type: "EXPENSE",
    subtype: "opex",
    normalBalance: "DEBIT",
    description: "General ops (future vendor bills).",
    sortOrder: 700,
  },
];

/** Account codes used by posting rules. */
export const ACCT = {
  CASH_STRIPE: "1000",
  CASH_VENMO: "1010",
  AR: "1100",
  DEFERRED_REV: "2000",
  PARTNER_PAYABLE: "2100",
  MEMBERSHIP_REV: "4000",
  TIPS_REV: "4010",
  OTHER_REV: "4020",
  STRIPE_FEES: "5000",
  PLATFORM_FEES: "5100",
  REFUNDS: "5200",
} as const;
