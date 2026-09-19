import "server-only";

import { isDatabaseConfigured } from "@/lib/database-config";

export const SOCIAL_CHANNELS = ["x", "instagram", "facebook"] as const;
export type SocialChannel = (typeof SOCIAL_CHANNELS)[number];

export type SocialDripPostRow = {
  id: string;
  body: string;
  mediaUrl: string | null;
  channels: SocialChannel[];
  status: string;
  scheduledAt: string;
  postedAt: string | null;
  lastError: string | null;
  createdBy: string | null;
};

function parseChannels(raw: string): SocialChannel[] {
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [...SOCIAL_CHANNELS];
    return arr.filter((c): c is SocialChannel =>
      (SOCIAL_CHANNELS as readonly string[]).includes(String(c)),
    );
  } catch {
    return [...SOCIAL_CHANNELS];
  }
}

export function socialCredentialsStatus(): Record<SocialChannel | "tiktok", boolean> {
  return {
    x: Boolean(process.env.SOCIAL_X_BEARER_TOKEN?.trim() || process.env.X_BEARER_TOKEN?.trim()),
    facebook: Boolean(
      process.env.SOCIAL_FACEBOOK_PAGE_ID?.trim() &&
        process.env.SOCIAL_FACEBOOK_PAGE_TOKEN?.trim(),
    ),
    instagram: Boolean(
      process.env.SOCIAL_INSTAGRAM_ACCOUNT_ID?.trim() &&
        process.env.SOCIAL_FACEBOOK_PAGE_TOKEN?.trim(),
    ),
    tiktok: false,
  };
}

export async function listSocialDripPosts(): Promise<SocialDripPostRow[]> {
  if (!isDatabaseConfigured()) return [];
  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.socialDripPost.findMany({
    orderBy: [{ status: "asc" }, { scheduledAt: "desc" }],
    take: 50,
  });
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    mediaUrl: r.mediaUrl,
    channels: parseChannels(r.channels),
    status: r.status,
    scheduledAt: r.scheduledAt.toISOString(),
    postedAt: r.postedAt?.toISOString() ?? null,
    lastError: r.lastError,
    createdBy: r.createdBy,
  }));
}

export async function queueSocialDripPost(input: {
  body: string;
  mediaUrl?: string | null;
  channels?: SocialChannel[];
  scheduledAt?: Date;
  createdBy?: string | null;
}): Promise<SocialDripPostRow> {
  const { prisma } = await import("@/lib/prisma");
  const channels = input.channels?.length ? input.channels : [...SOCIAL_CHANNELS];
  const row = await prisma.socialDripPost.create({
    data: {
      body: input.body.trim(),
      mediaUrl: input.mediaUrl?.trim() || null,
      channels: JSON.stringify(channels),
      status: "queued",
      scheduledAt: input.scheduledAt ?? new Date(),
      createdBy: input.createdBy ?? null,
    },
  });
  return {
    id: row.id,
    body: row.body,
    mediaUrl: row.mediaUrl,
    channels,
    status: row.status,
    scheduledAt: row.scheduledAt.toISOString(),
    postedAt: null,
    lastError: null,
    createdBy: row.createdBy,
  };
}

export async function dueSocialDripPosts(limit = 1) {
  const { prisma } = await import("@/lib/prisma");
  return prisma.socialDripPost.findMany({
    where: { status: "queued", scheduledAt: { lte: new Date() } },
    orderBy: { scheduledAt: "asc" },
    take: limit,
  });
}
