import { getAccount } from "serpapi";
import { z } from "zod";
import { isSerpKey } from "@/lib/context";
import { body, clientIp, json, rateLimit } from "@/lib/http";

export const runtime = "nodejs";

// Checks a visitor's own SerpApi key with the free Account API. The key is never stored or logged.
export async function POST(req: Request) {
  if (!rateLimit(`key:${clientIp(req)}`, 10, 600_000)) return json({ error: "RATE" }, 429);
  const b = await body(req, z.object({ key: z.string().trim().max(100) }));
  if (!b.ok) return b.res;
  if (!isSerpKey(b.data.key)) return json({ ok: false, error: "FORMAT" }, 400);
  try {
    const a = await getAccount({ api_key: b.data.key });
    return json({ ok: true, plan: a.plan_name, left: a.total_searches_left, perHour: a.account_rate_limit_per_hour });
  } catch {
    return json({ ok: false, error: "INVALID" }, 401);
  }
}
