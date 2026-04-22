import { subscribe } from "@/lib/realtime/bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Sur Vercel les fonctions sont cappées ; 5 min est le max sur le plan Pro.
// EventSource reconnecte tout seul à la coupure, c'est transparent côté client.
export const maxDuration = 300;

const HEARTBEAT_INTERVAL_MS = 25_000;

export async function GET(req: Request) {
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        controller.enqueue(encoder.encode(chunk));
      };
      send(": connected\n\n");
      unsubscribe = subscribe(send);
      heartbeat = setInterval(() => {
        try {
          send(": ping\n\n");
        } catch {
          /* no-op */
        }
      }, HEARTBEAT_INTERVAL_MS);

      req.signal.addEventListener("abort", () => {
        if (heartbeat) clearInterval(heartbeat);
        if (unsubscribe) unsubscribe();
        try {
          controller.close();
        } catch {
          /* déjà fermé */
        }
      });
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
