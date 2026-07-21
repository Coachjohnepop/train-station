import {
  getLiveClassZoom,
  isLiveClassHostActive,
  memberLiveZoomStatus,
} from "@/lib/live-class-zoom";
import { subscribeAnyLiveClassZoom, subscribeLiveClassZoom } from "@/lib/live-class-zoom-hot";
import { requireMemberAccess } from "@/lib/api-auth";
import { normalizeLiveSessionDate } from "@/lib/live-workout-session";
import { localTodayIso } from "@/lib/program-calendar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Instant member Join updates when coach hits Join Live Now.
 * Hot-cache SSE on same instance + members still poll as backup across instances.
 */
export async function GET(request: Request) {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const sessionDate = normalizeLiveSessionDate(
    searchParams.get("date") || localTodayIso(),
  );
  const encoder = new TextEncoder();

  let unsubDay: (() => void) | undefined;
  let unsubAny: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const sendStatus = async () => {
        try {
          const status = await memberLiveZoomStatus({
            memberEmail: auth.session.email,
            userId: auth.session.id,
            sessionDate,
          });
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(status)}\n\n`),
          );
        } catch {
          /* stream may be closed */
        }
      };

      void sendStatus();

      const onUpdate = () => {
        void sendStatus();
      };

      unsubDay = subscribeLiveClassZoom(sessionDate, onUpdate);
      // Also catch coach writes that use a slightly different date key edge case.
      unsubAny = subscribeAnyLiveClassZoom((record, date) => {
        if (date === sessionDate || !record) onUpdate();
      });

      // Seed hot from durable store if this instance is cold.
      void getLiveClassZoom(sessionDate).then((r) => {
        if (r && isLiveClassHostActive(r)) void sendStatus();
      });

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          /* closed */
        }
      }, 15_000);
    },
    cancel() {
      unsubDay?.();
      unsubAny?.();
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
