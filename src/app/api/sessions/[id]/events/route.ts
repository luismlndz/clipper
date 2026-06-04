import { manager } from "@/lib/pipeline/manager";
import type { PipelineEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream of pipeline events for one session. The browser
 * subscribes with EventSource and renders transcript, scores, and clips live.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = manager.get(params.id);
  if (!session) {
    return new Response("session not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let heartbeat: NodeJS.Timeout;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: PipelineEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          /* controller closed */
        }
      };
      unsubscribe = session.subscribe(send);
      // Keep intermediaries from buffering / timing out the connection.
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          /* closed */
        }
      }, 15000);
    },
    cancel() {
      clearInterval(heartbeat);
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
