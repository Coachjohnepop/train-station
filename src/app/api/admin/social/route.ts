import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCoachStaff } from "@/lib/api-auth";
import {
  listSocialDripPosts,
  queueSocialDripPost,
  socialCredentialsStatus,
  socialEnvPresent,
  SOCIAL_CHANNELS,
  SOCIAL_INSTAGRAM_HANDLE,
  dueSocialDripPosts,
} from "@/lib/social-drip";
import { publishSocialDrip } from "@/lib/social-publish";
import { isDatabaseConfigured } from "@/lib/database-config";

export const dynamic = "force-dynamic";

const schema = z.object({
  body: z.string().min(1).max(2200),
  mediaUrl: z.string().url().optional().nullable(),
  channels: z.array(z.enum(["x", "instagram", "facebook"])).optional(),
});

export async function GET() {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;
  const [posts, credentials] = await Promise.all([
    listSocialDripPosts(),
    Promise.resolve(socialCredentialsStatus()),
  ]);
  return NextResponse.json({
    posts,
    credentials,
    env: socialEnvPresent(),
    channels: SOCIAL_CHANNELS,
    instagramHandle: SOCIAL_INSTAGRAM_HANDLE,
    tiktok: "later",
  });
}

export async function POST(request: Request) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Need caption text." }, { status: 400 });
  }
  const post = await queueSocialDripPost({
    body: parsed.data.body,
    mediaUrl: parsed.data.mediaUrl,
    channels: parsed.data.channels,
    createdBy: auth.session.email || auth.session.id,
  });
  return NextResponse.json({ ok: true, post });
}

export async function DELETE(request: Request) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "No database" }, { status: 503 });
  }
  const { prisma } = await import("@/lib/prisma");
  await prisma.socialDripPost.update({
    where: { id },
    data: { status: "canceled" },
  });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => ({}))) as { action?: string; id?: string };
  if (body.action !== "publish-due") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "No database" }, { status: 503 });
  }
  const due = await dueSocialDripPosts(1);
  if (due.length === 0) return NextResponse.json({ ok: true, posted: 0 });
  const { prisma } = await import("@/lib/prisma");
  const post = due[0]!;
  let channels: Array<"x" | "instagram" | "facebook"> = ["x", "instagram", "facebook"];
  try {
    channels = (JSON.parse(post.channels) as string[]).filter(
      (c): c is "x" | "instagram" | "facebook" =>
        c === "x" || c === "instagram" || c === "facebook",
    );
  } catch {
    /* default */
  }
  const results = await publishSocialDrip({
    body: post.body,
    mediaUrl: post.mediaUrl,
    channels,
  });
  const failed = results.filter((r) => !r.ok);
  await prisma.socialDripPost.update({
    where: { id: post.id },
    data: {
      status: failed.length === results.length ? "failed" : failed.length ? "partial" : "posted",
      postedAt: failed.length === results.length ? null : new Date(),
      lastError: failed.length ? failed.map((f) => `${f.channel}: ${f.detail}`).join(" · ") : null,
    },
  });
  return NextResponse.json({ ok: true, id: post.id, results });
}
