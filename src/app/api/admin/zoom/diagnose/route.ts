import { NextResponse } from "next/server";
import { requireCoachStaff } from "@/lib/api-auth";
import { getZoomOAuthDiagnostics } from "@/lib/zoom-oauth-diagnostics";
import { getZoomCoachStatus } from "@/lib/zoom-status";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const [status, diagnostics] = await Promise.all([
    getZoomCoachStatus(),
    getZoomOAuthDiagnostics(),
  ]);

  return NextResponse.json(
    {
      status,
      diagnostics,
      hint:
        diagnostics.tokenProbe === "invalid_client"
          ? "ZOOM_CLIENT_ID/SECRET mismatch — copy Development credentials from marketplace.zoom.us into Vercel Production, then redeploy."
          : diagnostics.tokenProbe === "invalid_grant"
            ? "Credentials look valid — complete Connect in Settings; exchange should work after Zoom approves."
            : !diagnostics.blobWriteOk
              ? "Blob writes failing — OAuth may connect then fail to save tokens."
              : null,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    },
  );
}