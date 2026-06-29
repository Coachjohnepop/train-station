import { NextResponse } from "next/server";
import { listEnabledOAuthProviders } from "@/lib/oauth/config";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ providers: listEnabledOAuthProviders() });
}