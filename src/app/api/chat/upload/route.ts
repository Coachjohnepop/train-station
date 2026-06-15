import { NextResponse } from "next/server";
import { storeChatVideo } from "@/lib/chat-storage";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const durationRaw = form.get("durationSec");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const durationSec = Number(durationRaw);
    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      return NextResponse.json({ error: "durationSec is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeChatVideo(buffer, file.type || "video/mp4", durationSec);

    return NextResponse.json(stored);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Upload failed" }, { status: 400 });
  }
}