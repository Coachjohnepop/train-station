import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import {
  addSiteVideoLibraryItem,
  getSiteVideoLibrary,
  removeSiteVideoLibraryItem,
  updateSiteVideoLibraryItem,
} from "@/lib/site-video-library-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) {
    return NextResponse.json({ error: "Coach sign-in required." }, { status: 401 });
  }

  const library = await getSiteVideoLibrary();
  return NextResponse.json({ ok: true, items: library.items, updatedAt: library.updatedAt });
}

const postSchema = z.object({
  action: z.enum(["add", "rename", "replace"]).default("add"),
  id: z.string().max(80).optional(),
  url: z.string().max(2000).optional(),
  title: z.string().max(200).optional(),
  fileName: z.string().max(300).optional().nullable(),
});

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) {
    return NextResponse.json({ error: "Coach sign-in required." }, { status: 401 });
  }

  try {
    const body = postSchema.parse(await request.json());

    if (body.action === "rename") {
      if (!body.id) {
        return NextResponse.json({ error: "id is required to rename." }, { status: 400 });
      }
      const item = await updateSiteVideoLibraryItem(body.id, { title: body.title || "" });
      return NextResponse.json({ ok: true, item });
    }

    if (body.action === "replace") {
      if (!body.id) {
        return NextResponse.json({ error: "id is required to replace." }, { status: 400 });
      }
      if (!body.url?.trim()) {
        return NextResponse.json({ error: "url is required to replace." }, { status: 400 });
      }
      const before = await getSiteVideoLibrary();
      const prev = before.items.find((i) => i.id === body.id);
      const previousUrl = prev?.url ?? null;
      const item = await updateSiteVideoLibraryItem(body.id, {
        url: body.url,
        fileName: body.fileName ?? null,
        ...(body.title !== undefined ? { title: body.title } : {}),
      });
      return NextResponse.json({ ok: true, item, previousUrl });
    }

    if (!body.url?.trim()) {
      return NextResponse.json({ error: "url is required." }, { status: 400 });
    }

    const item = await addSiteVideoLibraryItem({
      url: body.url,
      title: body.title,
      fileName: body.fileName ?? undefined,
      id: body.id,
    });
    return NextResponse.json({ ok: true, item });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Library update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) {
    return NextResponse.json({ error: "Coach sign-in required." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get("id")?.trim() || "";
    if (!id) {
      const body = (await request.json().catch(() => ({}))) as { id?: string };
      id = body.id?.trim() || "";
    }
    if (!id) {
      return NextResponse.json({ error: "id is required." }, { status: 400 });
    }
    await removeSiteVideoLibraryItem(id);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
