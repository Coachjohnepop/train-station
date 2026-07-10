import "server-only";

import type { ReferralCode } from "@/lib/referral-codes-store";
import { prisma } from "@/lib/prisma";

function toIso(value: Date): string {
  return value.toISOString();
}

function rowToReferralCode(row: {
  id: string;
  code: string;
  label: string;
  stripePromotionCodeId: string | null;
  stripeCouponId: string | null;
  ownerUserId: string | null;
  enabled: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ReferralCode {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    stripePromotionCodeId: row.stripePromotionCodeId,
    stripeCouponId: row.stripeCouponId,
    ownerUserId: row.ownerUserId,
    enabled: row.enabled,
    notes: row.notes,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function codeToRow(code: ReferralCode) {
  return {
    id: code.id,
    code: code.code,
    label: code.label,
    stripePromotionCodeId: code.stripePromotionCodeId,
    stripeCouponId: code.stripeCouponId,
    ownerUserId: code.ownerUserId,
    enabled: code.enabled,
    notes: code.notes,
    createdAt: new Date(code.createdAt),
    updatedAt: new Date(code.updatedAt),
  };
}

export async function listReferralCodesFromDb(): Promise<ReferralCode[]> {
  const rows = await prisma.referralCode.findMany({ orderBy: { code: "asc" } });
  return rows.map(rowToReferralCode);
}

export async function getReferralCodeByCodeFromDb(code: string): Promise<ReferralCode | null> {
  const row = await prisma.referralCode.findUnique({ where: { code } });
  return row ? rowToReferralCode(row) : null;
}

export async function getReferralCodeByIdFromDb(id: string): Promise<ReferralCode | null> {
  const row = await prisma.referralCode.findUnique({ where: { id } });
  return row ? rowToReferralCode(row) : null;
}

export async function upsertReferralCodeToDb(code: ReferralCode): Promise<void> {
  const data = codeToRow(code);
  await prisma.referralCode.upsert({
    where: { id: code.id },
    create: data,
    update: {
      code: data.code,
      label: data.label,
      stripePromotionCodeId: data.stripePromotionCodeId,
      stripeCouponId: data.stripeCouponId,
      ownerUserId: data.ownerUserId,
      enabled: data.enabled,
      notes: data.notes,
      updatedAt: data.updatedAt,
    },
  });
}

export async function deleteReferralCodeFromDb(id: string): Promise<boolean> {
  const result = await prisma.referralCode.deleteMany({ where: { id } });
  return result.count > 0;
}

export async function probeReferralCodesDb(): Promise<{ ok: boolean; message: string | null }> {
  try {
    await prisma.referralCode.count();
    return { ok: true, message: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Referral codes DB probe failed";
    return { ok: false, message };
  }
}