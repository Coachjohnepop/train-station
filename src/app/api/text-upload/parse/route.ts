import { NextResponse } from "next/server";
import { z } from "zod";
import { parseTextUpload } from "@/lib/text-upload-build";
import { requireStaff } from "@/lib/api-auth";

const schema = z.object({
  mode: z.enum(["exercises", "workout", "program-week"]),
  rawText: z.string().min(1),
});

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }

  const result = parseTextUpload(parsed.data.mode, parsed.data.rawText.trim());
  return NextResponse.json(result);
}