import { NextResponse } from "next/server";
import { requireCoachStaff } from "@/lib/api-auth";
import { ensureBookingZoomLink } from "@/lib/booking";
import { zoomConfigured } from "@/lib/zoom";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const auth = await requireCoachStaff();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    const result = await ensureBookingZoomLink(id);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      configured: zoomConfigured(),
      reused: result.reused,
      demo: "demo" in result.zoom && result.zoom.demo === true,
      booking: result.booking,
      zoom: {
        meetingId: result.zoom.meetingId,
        joinUrl: result.zoom.joinUrl,
        hostUrl: result.zoom.hostUrl,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create Zoom meeting.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}