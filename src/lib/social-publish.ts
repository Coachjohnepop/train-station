import "server-only";

import type { SocialChannel } from "@/lib/social-drip";

type PublishResult = { channel: SocialChannel; ok: boolean; detail: string };

async function postX(body: string): Promise<PublishResult> {
  const token = process.env.SOCIAL_X_BEARER_TOKEN?.trim() || process.env.X_BEARER_TOKEN?.trim();
  if (!token) return { channel: "x", ok: false, detail: "missing SOCIAL_X_BEARER_TOKEN" };
  const res = await fetch("https://api.x.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: body.slice(0, 280) }),
  });
  const text = await res.text();
  return { channel: "x", ok: res.ok, detail: text.slice(0, 240) };
}

async function postFacebook(body: string): Promise<PublishResult> {
  const pageId = process.env.SOCIAL_FACEBOOK_PAGE_ID?.trim();
  const token = process.env.SOCIAL_FACEBOOK_PAGE_TOKEN?.trim();
  if (!pageId || !token) {
    return { channel: "facebook", ok: false, detail: "missing SOCIAL_FACEBOOK_PAGE_ID / TOKEN" };
  }
  const url = new URL(`https://graph.facebook.com/v21.0/${pageId}/feed`);
  url.searchParams.set("message", body);
  url.searchParams.set("access_token", token);
  const res = await fetch(url, { method: "POST" });
  const text = await res.text();
  return { channel: "facebook", ok: res.ok, detail: text.slice(0, 240) };
}

async function postInstagram(body: string, mediaUrl: string | null): Promise<PublishResult> {
  const igId = process.env.SOCIAL_INSTAGRAM_ACCOUNT_ID?.trim();
  const token = process.env.SOCIAL_FACEBOOK_PAGE_TOKEN?.trim();
  if (!igId || !token) {
    return { channel: "instagram", ok: false, detail: "missing SOCIAL_INSTAGRAM_ACCOUNT_ID / PAGE_TOKEN" };
  }
  if (!mediaUrl) {
    return { channel: "instagram", ok: false, detail: "Instagram needs an image URL" };
  }
  const createUrl = new URL(`https://graph.facebook.com/v21.0/${igId}/media`);
  createUrl.searchParams.set("image_url", mediaUrl);
  createUrl.searchParams.set("caption", body.slice(0, 2200));
  createUrl.searchParams.set("access_token", token);
  const created = await fetch(createUrl, { method: "POST" });
  const createdBody = (await created.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!created.ok || !createdBody.id) {
    return { channel: "instagram", ok: false, detail: createdBody.error?.message || "IG container failed" };
  }
  const pubUrl = new URL(`https://graph.facebook.com/v21.0/${igId}/media_publish`);
  pubUrl.searchParams.set("creation_id", createdBody.id);
  pubUrl.searchParams.set("access_token", token);
  const pub = await fetch(pubUrl, { method: "POST" });
  const text = await pub.text();
  return { channel: "instagram", ok: pub.ok, detail: text.slice(0, 240) };
}

export async function publishSocialDrip(input: {
  body: string;
  mediaUrl: string | null;
  channels: SocialChannel[];
}): Promise<PublishResult[]> {
  const out: PublishResult[] = [];
  for (const ch of input.channels) {
    if (ch === "x") out.push(await postX(input.body));
    else if (ch === "facebook") out.push(await postFacebook(input.body));
    else if (ch === "instagram") out.push(await postInstagram(input.body, input.mediaUrl));
  }
  return out;
}
