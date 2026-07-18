import { getAuth } from "../../../../../server/auth";
import { getDashboardRepository } from "../../../../../server/dashboard-runtime";

export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

export async function GET(request: Request): Promise<Response> {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (session === null) return new Response("Unauthorized", { status: 401 });
  const repository = getDashboardRepository();
  const context = await repository.contextForUser(session.user.id);
  if (context === undefined) return new Response("Forbidden", { status: 403 });

  let cursor = new Date();
  let timer: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      if (timer !== undefined) clearInterval(timer);
    },
    start(controller) {
      controller.enqueue(
        encoder.encode("retry: 3000\nevent: ready\ndata: {}\n\n")
      );
      timer = setInterval(() => {
        void repository
          .eventsAfter(context.environmentId, cursor)
          .then((events) => {
            for (const event of events) {
              cursor = event.occurred_at;
              controller.enqueue(
                encoder.encode(
                  `id: ${event.event_id}\nevent: trace\ndata: ${JSON.stringify({ eventType: event.event_type, traceId: event.trace_id })}\n\n`
                )
              );
            }
            if (events.length === 0)
              controller.enqueue(encoder.encode(": keepalive\n\n"));
          })
          .catch(() => controller.error(new Error("Event stream unavailable")));
      }, 2_000);
      request.signal.addEventListener("abort", () => {
        if (timer !== undefined) clearInterval(timer);
        controller.close();
      });
    }
  });
  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream"
    }
  });
}
