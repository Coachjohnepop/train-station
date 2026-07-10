import "server-only";

import type { CommissionPartner } from "@/lib/commission-partners-store";
import { prisma } from "@/lib/prisma";

function toIso(value: Date): string {
  return value.toISOString();
}

function rowToPartner(row: {
  id: string;
  name: string;
  email: string;
  stripeAccountId: string | null;
  sharePercent: number;
  enabled: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CommissionPartner {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    stripeAccountId: row.stripeAccountId,
    sharePercent: row.sharePercent,
    enabled: row.enabled,
    notes: row.notes,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function partnerToRow(partner: CommissionPartner) {
  return {
    id: partner.id,
    name: partner.name,
    email: partner.email,
    stripeAccountId: partner.stripeAccountId,
    sharePercent: partner.sharePercent,
    enabled: partner.enabled,
    notes: partner.notes,
    createdAt: new Date(partner.createdAt),
    updatedAt: new Date(partner.updatedAt),
  };
}

export async function listCommissionPartnersFromDb(): Promise<CommissionPartner[]> {
  const rows = await prisma.commissionPartner.findMany({ orderBy: { name: "asc" } });
  return rows.map(rowToPartner);
}

export async function getCommissionPartnerFromDb(id: string): Promise<CommissionPartner | null> {
  const row = await prisma.commissionPartner.findUnique({ where: { id } });
  return row ? rowToPartner(row) : null;
}

export async function upsertCommissionPartnerToDb(partner: CommissionPartner): Promise<void> {
  const data = partnerToRow(partner);
  await prisma.commissionPartner.upsert({
    where: { id: partner.id },
    create: data,
    update: {
      name: data.name,
      email: data.email,
      stripeAccountId: data.stripeAccountId,
      sharePercent: data.sharePercent,
      enabled: data.enabled,
      notes: data.notes,
      updatedAt: data.updatedAt,
    },
  });
}

export async function deleteCommissionPartnerFromDb(id: string): Promise<boolean> {
  const result = await prisma.commissionPartner.deleteMany({ where: { id } });
  return result.count > 0;
}

export async function probeCommissionPartnersDb(): Promise<{ ok: boolean; message: string | null }> {
  try {
    await prisma.commissionPartner.count();
    return { ok: true, message: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Commission partners DB probe failed";
    return { ok: false, message };
  }
}