import "server-only";

import type { CustomTrainingOffer } from "@/lib/custom-training-offers-store";
import type { CustomTrainingParameters } from "@/lib/product-offers";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

function toIso(value: Date): string {
  return value.toISOString();
}

function parseParameters(raw: unknown): CustomTrainingParameters {
  const params = (raw && typeof raw === "object" ? raw : {}) as Partial<CustomTrainingParameters>;
  return {
    daysPerWeek: Math.max(1, Math.min(7, Number(params.daysPerWeek) || 3)),
    minutesPerSession: Math.max(15, Math.min(180, Number(params.minutesPerSession) || 60)),
    sessionsPerDay: Math.max(1, Math.min(4, Number(params.sessionsPerDay) || 1)),
    dropInDays: Array.isArray(params.dropInDays)
      ? params.dropInDays.map((d) => String(d).toLowerCase())
      : [],
    notes: typeof params.notes === "string" ? params.notes : null,
  };
}

function rowToOffer(row: {
  id: string;
  label: string;
  memberEmail: string | null;
  memberUserId: string | null;
  priceCents: number;
  currency: string;
  parameters: unknown;
  status: string;
  stripeCheckoutSessionId: string | null;
  createdByEmail: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CustomTrainingOffer {
  const status =
    row.status === "sent" || row.status === "paid" || row.status === "canceled"
      ? row.status
      : "draft";

  return {
    id: row.id,
    label: row.label,
    memberEmail: row.memberEmail,
    memberUserId: row.memberUserId,
    priceCents: row.priceCents,
    currency: row.currency,
    parameters: parseParameters(row.parameters),
    status,
    stripeCheckoutSessionId: row.stripeCheckoutSessionId,
    createdByEmail: row.createdByEmail,
    notes: row.notes,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function offerToRow(offer: CustomTrainingOffer) {
  return {
    id: offer.id,
    label: offer.label,
    memberEmail: offer.memberEmail,
    memberUserId: offer.memberUserId,
    priceCents: offer.priceCents,
    currency: offer.currency,
    parameters: offer.parameters as Prisma.InputJsonValue,
    status: offer.status,
    stripeCheckoutSessionId: offer.stripeCheckoutSessionId,
    createdByEmail: offer.createdByEmail,
    notes: offer.notes,
    createdAt: new Date(offer.createdAt),
    updatedAt: new Date(offer.updatedAt),
  };
}

export async function listCustomTrainingOffersFromDb(): Promise<CustomTrainingOffer[]> {
  const rows = await prisma.customTrainingOffer.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(rowToOffer);
}

export async function getCustomTrainingOfferFromDb(id: string): Promise<CustomTrainingOffer | null> {
  const row = await prisma.customTrainingOffer.findUnique({ where: { id } });
  return row ? rowToOffer(row) : null;
}

export async function createCustomTrainingOfferInDb(offer: CustomTrainingOffer): Promise<void> {
  const data = offerToRow(offer);
  await prisma.customTrainingOffer.create({ data });
}

export async function updateCustomTrainingOfferInDb(offer: CustomTrainingOffer): Promise<void> {
  const data = offerToRow(offer);
  await prisma.customTrainingOffer.update({
    where: { id: offer.id },
    data: {
      label: data.label,
      memberEmail: data.memberEmail,
      memberUserId: data.memberUserId,
      priceCents: data.priceCents,
      currency: data.currency,
      parameters: data.parameters,
      status: data.status,
      stripeCheckoutSessionId: data.stripeCheckoutSessionId,
      createdByEmail: data.createdByEmail,
      notes: data.notes,
      updatedAt: data.updatedAt,
    },
  });
}

export async function probeCustomTrainingOffersDb(): Promise<{ ok: boolean; message: string | null }> {
  try {
    await prisma.customTrainingOffer.count();
    return { ok: true, message: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Custom training offers DB probe failed";
    return { ok: false, message };
  }
}