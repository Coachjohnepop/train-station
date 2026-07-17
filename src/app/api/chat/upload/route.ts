import { NextResponse } from "next/server";
import { requireChatMediaUploadAccess } from "@/lib/chat-compose-auth";
import { storeChatImage, storeChatVideo } from "@/lib/chat-storage";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const kind = String(form.get("kind") || "video");
    const durationRaw = form.get("durationSec");

    const auth = await requireChatMediaUploadAccess(kind === "image" ? "image" : "video");
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 403 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (kind === "image") {
      const stored = await storeChatImage(buffer, file.type || "image/jpeg");
      return NextResponse.json({ ...stored, kind: "image" });
    }

    const durationSec = Number(durationRaw);
    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      return NextResponse.json({ error: "durationSec is required for video" }, { status: 400 });
    }

    const stored = await storeChatVideo(buffer, file.type || "video/mp4", durationSec);
    return NextResponse.json({ ...stored, kind: "video" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Upload failed" }, { status: 400 });
  }
}