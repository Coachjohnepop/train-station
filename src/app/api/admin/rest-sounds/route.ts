import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCoachStaff } from "@/lib/api-auth";
import {
  addRestSoundLibraryItem,
  getRestSoundLibrary,
  removeRestSoundLibraryItem,
  renameRestSoundLibraryItem,
  setRestSoundLibraryDefault,
} from "@/lib/rest-sound-library-store";
import {
  REST_SOUND_ALLOWED_MIME,
  REST_SOUND_MAX_BYTES,
  restSoundMimeFromName,
  storeRestSound,
  validateRestSoundFile,
} from "@/lib/rest-sound-storage";
import { DEFAULT_REST_TIMER_SOUND, REST_TIMER_SOUND_OPTIONS } from "@/lib/rest-timer-sound";
import { isBlobConfigured } from "@/lib/demo-json-blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { BLOB_TOKEN } from "@/lib/demo-json-blob";
import { getSessionUser, isStaffRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const library = await getRestSoundLibrary();
  return NextResponse.json({
    system: REST_TIMER_SOUND_OPTIONS,
    defaultSoundKey: library.defaultSoundKey || DEFAULT_REST_TIMER_SOUND,
    items: library.items,
    maxBytes: REST_SOUND_MAX_BYTES,
    allowedMime: Array.from(REST_SOUND_ALLOWED_MIME),
    clientUpload: isBlobConfigured(),
  });
}

const patchSchema = z.object({
  action: z.enum(["rename", "delete", "setDefault", "add"]),
  id: z.string().min(1).optional(),
  title: z.string().min(1).max(120).optional(),
  url: z.string().min(1).max(2000).optional(),
  fileName: z.string().max(240).optional().nullable(),
  defaultSoundKey: z.string().max(2000).nullable().optional(),
});

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) {
    return NextResponse.json({ error: "Coach sign-in required." }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") || "";

  // Client → Blob direct upload token
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null);
    // handleUpload body vs library JSON actions
    if (body && typeof body === "object" && "type" in body) {
      if (!isBlobConfigured()) {
        return NextResponse.json(
          { error: "Blob storage is not configured for large uploads." },
          { status: 503 },
        );
      }
      try {
        const jsonResponse = await handleUpload({
          body: body as HandleUploadBody,
          request,
          token: BLOB_TOKEN,
          onBeforeGenerateToken: async (pathname) => {
            if (!pathname.startsWith("rest-sounds/")) {
              throw new Error("Invalid upload path.");
            }
            return {
              allowedContentTypes: Array.from(REST_SOUND_ALLOWED_MIME),
              maximumSizeInBytes: REST_SOUND_MAX_BYTES,
              addRandomSuffix: false,
              allowOverwrite: true,
              tokenPayload: JSON.stringify({ coachId: session.id }),
            };
          },
          onUploadCompleted: async () => {},
        });
        return NextResponse.json(jsonResponse);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Upload token failed";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const data = parsed.data;
    try {
      if (data.action === "add") {
        if (!data.url?.trim()) {
          return NextResponse.json({ error: "url required" }, { status: 400 });
        }
        const library = await addRestSoundLibraryItem({
          title: data.title || "Custom rest sound",
          url: data.url.trim(),
          fileName: data.fileName,
        });
        return NextResponse.json({ ok: true, library });
      }
      if (data.action === "rename") {
        if (!data.id || !data.title) {
          return NextResponse.json({ error: "id and title required" }, { status: 400 });
        }
        const library = await renameRestSoundLibraryItem(data.id, data.title);
        return NextResponse.json({ ok: true, library });
      }
      if (data.action === "delete") {
        if (!data.id) {
          return NextResponse.json({ error: "id required" }, { status: 400 });
        }
        const library = await removeRestSoundLibraryItem(data.id);
        return NextResponse.json({ ok: true, library });
      }
      if (data.action === "setDefault") {
        const library = await setRestSoundLibraryDefault(
          data.defaultSoundKey === undefined ? null : data.defaultSoundKey,
        );
        return NextResponse.json({ ok: true, library });
      }
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Update failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  // FormData server upload
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    const mime = file.type || restSoundMimeFromName(file.name);
    validateRestSoundFile({ size: file.size, mimeType: mime, name: file.name });
    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeRestSound(buffer, mime, file.name);
    const title =
      (typeof form.get("title") === "string" && String(form.get("title")).trim()) ||
      file.name.replace(/\.[^.]+$/, "") ||
      "Custom rest sound";
    const library = await addRestSoundLibraryItem({
      title,
      url: stored.url,
      fileName: file.name,
    });
    return NextResponse.json({ ok: true, url: stored.url, library });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
