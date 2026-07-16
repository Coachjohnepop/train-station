import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { listSmsLedger } from "@/lib/sms-delivery";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const logs = await listSmsLedger(50);
  return NextResponse.json(logs);
}