import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCoachStaff } from "@/lib/api-auth";
import { fetchLinkPreview } from "@/lib/link-preview";

export const dynamic = "force-dynamic";

const schema = z.object({
  url: z.string().min(8).max(2000),
});

/** Coach pastes a product link → title + image preview for equipment card. */
export async function POST(request: Request) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Paste a product URL." }, { status: 400 });
  }

  try {
    const preview = await fetchLinkPreview(parsed.data.url);
    return NextResponse.json(preview);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read that link.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
