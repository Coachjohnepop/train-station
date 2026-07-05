import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { listPrescriptionExamples } from "@/lib/prescription-examples-db";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const examples = await listPrescriptionExamples();
  return NextResponse.json({ examples });
}