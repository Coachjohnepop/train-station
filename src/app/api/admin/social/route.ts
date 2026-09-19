import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCoachStaff } from "@/lib/api-auth";
import {
  listSocialDripPosts,
  queueSocialDripPost,
  socialCredentialsStatus,
  SOCIAL_CHANNELS,
} from "@/lib/social-drip";

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
  return NextResponse.json({ posts, credentials, channels: SOCIAL_CHANNELS });
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
