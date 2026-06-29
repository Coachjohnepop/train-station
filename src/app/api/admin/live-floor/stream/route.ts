import { buildCoachLiveFloor } from "@/lib/coach-live-floor";
import { liveSessionKey, normalizeLiveSessionDate } from "@/lib/live-workout-session";
import { subscribeLiveSession } from "@/lib/live-session-hot";
import { getSessionUser, isStaffRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionDate = normalizeLiveSessionDate(searchParams.get("date") || undefined);
  const encoder = new TextEncoder();

  let unsubs: Array<() => void> = [];
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const push = async () => {
        const floor = await buildCoachLiveFloor(sessionDate);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "floor", floor })}\n\n`),
        );

        const keys = new Set(
          floor.tiles.map((t) => liveSessionKey(t.userId, t.workoutId, sessionDate)),
        );

        for (const off of unsubs) off();
        unsubs = [...keys].map((key) =>
          subscribeLiveSession(key, () => {
            if (debounce) clearTimeout(debounce);
            debounce = setTimeout(() => void push(), 120);
          }),
        );
      };

      await push();

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          /* closed */
        }
      }, 25_000);
    },
    cancel() {
      for (const off of unsubs) off();
      if (debounce) clearTimeout(debounce);
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}