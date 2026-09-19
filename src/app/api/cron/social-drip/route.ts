import { NextResponse } from "next/server";
import { dueSocialDripPosts } from "@/lib/social-drip";
import { publishSocialDrip } from "@/lib/social-publish";
import { isDatabaseConfigured } from "@/lib/database-config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  return (request.headers.get("authorization") || "") === `Bearer ${secret}`;
}

function parseChannels(raw: string): Array<"x" | "instagram" | "facebook"> {
  try {
    const arr = JSON.parse(raw) as string[];
    return arr.filter((c): c is "x" | "instagram" | "facebook" =>
      c === "x" || c === "instagram" || c === "facebook",
    );
  } catch {
    return ["x", "instagram", "facebook"];
  }
}

/** Daily 16:00 UTC — post one due drip item. No-ops until tokens are in Vercel env. */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, detail: "no database" }, { status: 503 });
  }
  const due = await dueSocialDripPosts(1);
  if (due.length === 0) {
    return NextResponse.json({ ok: true, posted: 0 });
  }
  const { prisma } = await import("@/lib/prisma");
  const post = due[0]!;
  const results = await publishSocialDrip({
    body: post.body,
    mediaUrl: post.mediaUrl,
    channels: parseChannels(post.channels),
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
