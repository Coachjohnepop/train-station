import {
  getLiveWorkoutSession,
  liveSessionKey,
  normalizeLiveSessionDate,
} from "@/lib/live-workout-session";
import { getHotLiveSession, subscribeLiveSession } from "@/lib/live-session-hot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id: workoutId } = await params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return new Response("userId required", { status: 400 });
  }

  const sessionDate = normalizeLiveSessionDate(searchParams.get("date") || undefined);
  const key = liveSessionKey(userId, workoutId, sessionDate);
  const encoder = new TextEncoder();

  let unsubscribe: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (session: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ session })}\n\n`),
        );
      };

      const hot = getHotLiveSession(key);
      if (hot) send(hot);
      else {
        void getLiveWorkoutSession({ userId, workoutId, sessionDate }).then((s) =>
          send(s),
        );
      }

      unsubscribe = subscribeLiveSession(key, (session) => send(session));

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          /* stream closed */
        }
      }, 20_000);
    },
    cancel() {
      unsubscribe?.();
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