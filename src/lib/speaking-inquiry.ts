import "server-only";

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  SPEAKING_EVENT_TYPES,
  SPEAKING_FORMATS,
} from "@/lib/speaking-inquiry-client";

export {
  SPEAKING_EVENT_TYPES,
  SPEAKING_FORMATS,
  SPEAKING_AUDIENCE_SIZES,
  SPEAKING_BUDGET_RANGES,
} from "@/lib/speaking-inquiry-client";

export type SpeakingInquiryInput = {
  userId?: string | null;
  email: string;
  name?: string | null;
  phone?: string | null;
  eventType: string;
  format: string;
  audienceSize?: string | null;
  audienceDesc?: string | null;
  organization?: string | null;
  eventDate?: string | null;
  locationCity?: string | null;
  locationState?: string | null;
  budgetRange?: string | null;
  topicsGoals?: string | null;
  extraNotes?: string | null;
};

export type SpeakingInquiryRecord = {
  id: string;
  userId: string | null;
  email: string;
  name: string | null;
  phone: string | null;
  eventType: string;
  format: string;
  audienceSize: string | null;
  audienceDesc: string | null;
  organization: string | null;
  eventDate: string | null;
  locationCity: string | null;
  locationState: string | null;
  budgetRange: string | null;
  topicsGoals: string | null;
  extraNotes: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

function rowToRecord(row: {
  id: string;
  userId: string | null;
  email: string;
  name: string | null;
  phone: string | null;
  eventType: string;
  format: string;
  audienceSize: string | null;
  audienceDesc: string | null;
  organization: string | null;
  eventDate: string | null;
  locationCity: string | null;
  locationState: string | null;
  budgetRange: string | null;
  topicsGoals: string | null;
  extraNotes: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): SpeakingInquiryRecord {
  return {
    id: row.id,
    userId: row.userId,
    email: row.email,
    name: row.name,
    phone: row.phone,
    eventType: row.eventType,
    format: row.format,
    audienceSize: row.audienceSize,
    audienceDesc: row.audienceDesc,
    organization: row.organization,
    eventDate: row.eventDate,
    locationCity: row.locationCity,
    locationState: row.locationState,
    budgetRange: row.budgetRange,
    topicsGoals: row.topicsGoals,
    extraNotes: row.extraNotes,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createSpeakingInquiry(
  input: SpeakingInquiryInput,
): Promise<SpeakingInquiryRecord> {
  const now = new Date();
  const row = await prisma.speakingInquiry.create({
    data: {
      id: randomUUID(),
      userId: input.userId?.trim() || null,
      email: input.email.trim().toLowerCase(),
      name: input.name?.trim() || null,
      phone: input.phone?.trim() || null,
      eventType: input.eventType.trim(),
      format: input.format.trim(),
      audienceSize: input.audienceSize?.trim() || null,
      audienceDesc: input.audienceDesc?.trim() || null,
      organization: input.organization?.trim() || null,
      eventDate: input.eventDate?.trim() || null,
      locationCity: input.locationCity?.trim() || null,
      locationState: input.locationState?.trim() || null,
      budgetRange: input.budgetRange?.trim() || null,
      topicsGoals: input.topicsGoals?.trim() || null,
      extraNotes: input.extraNotes?.trim() || null,
      status: "submitted",
      createdAt: now,
      updatedAt: now,
    },
  });
  return rowToRecord(row);
}

export function formatSpeakingInquirySummary(row: SpeakingInquiryRecord): string {
  const eventLabel =
    SPEAKING_EVENT_TYPES.find((t) => t.id === row.eventType)?.label || row.eventType;
  const formatLabel =
    SPEAKING_FORMATS.find((t) => t.id === row.format)?.label || row.format;
  const parts = [
    `Type: ${eventLabel}`,
    `Format: ${formatLabel}`,
    row.organization ? `Org: ${row.organization}` : null,
    row.audienceSize ? `Audience: ${row.audienceSize}` : null,
    row.eventDate ? `Event date: ${row.eventDate}` : null,
    row.locationCity
      ? `Location: ${[row.locationCity, row.locationState].filter(Boolean).join(", ")}`
      : null,
    row.topicsGoals ? `Topics: ${row.topicsGoals.slice(0, 200)}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}
