import { z } from "zod";
import { investigate } from "@/lib/agent/pipeline";
import { contextFor } from "@/lib/context";
import { body, InputSchema, json } from "@/lib/http";
import { sseResponse } from "@/lib/sse";
import { clientIp, rateLimit } from "@/lib/store";
import { REFINE_OPTIONS } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const Schema = z.object({
  input: InputSchema,
  refine: z.enum(REFINE_OPTIONS as [string, ...string[]]).nullable().optional(),
  exclude: z.array(z.string().max(60)).max(20).optional(),
});

export async function POST(req: Request) {
  const b = await body(req, Schema);
  if (!b.ok) return b.res;
  const ip = clientIp(req);
  if (!rateLimit(`inv:${ip}`, 30, 3600_000)) return json({ error: "RATE", retryAfterSec: 3600 }, 429);
  const ctx = contextFor(req);
  const input = { ...b.data.input, regionHint: b.data.input.regionHint ?? b.data.input.home?.state };
  // The server's own key has a per-visitor allowance; beyond it the visitor gets a labelled recorded investigation.
  const force = ctx.key && !ctx.byo && !b.data.refine && !rateLimit(`live:${ip}`, Number(process.env.PER_IP_LIVE_PER_DAY || 2), 86400_000) ? "rate" : undefined;
  return sseResponse(req, (emit) => investigate(input, emit, { refine: b.data.refine, exclude: b.data.exclude, forceRecorded: force }));
}
