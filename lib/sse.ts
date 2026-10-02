import type { Emit } from "./agent/pipeline";
import { contextFor, runWith } from "./context";

/** Run `fn` inside the request's key context and stream its events back as text/event-stream. */
export function sseResponse(req: Request, fn: (emit: Emit) => Promise<unknown>) {
  const enc = new TextEncoder();
  const ctx = contextFor(req);
  let id = 0;
  const stream = new ReadableStream({
    start(ctl) {
      let open = true;
      const send = (s: string) => {
        if (!open) return;
        try {
          ctl.enqueue(enc.encode(s));
        } catch {
          open = false;
        }
      };
      const emit: Emit = (event, data) => send(`id: ${++id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      const ping = setInterval(() => send(": ping\n\n"), 15_000);
      req.signal.addEventListener("abort", () => (open = false));
      void runWith(ctx, () => fn(emit)).finally(() => {
        clearInterval(ping);
        if (open) ctl.close();
        open = false;
      });
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}
