import { getAccount } from "serpapi";
import { usedToday } from "@/lib/budget";
import { json } from "@/lib/http";
import { library } from "@/lib/library";
import { contextFor, deployMode, runWith } from "@/lib/context";
import { mode } from "@/lib/serp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public, non-sensitive status for the "Rasoi ke peeche" drawer. Account numbers only with OPS_TOKEN.
export async function GET(req: Request) {
  const ctx = contextFor(req);
  const base = { mode: runWith(ctx, mode), ownKey: ctx.byo, deploy: deployMode(), usedToday: await usedToday(), cap: Number(process.env.DAILY_CREDIT_CAP || 40), llm: !!process.env.ANTHROPIC_API_KEY, library: library().length };
  const token = process.env.OPS_TOKEN;
  if (!token || req.headers.get("authorization") !== `Bearer ${token}` || !process.env.SERPAPI_API_KEY || deployMode()) return json(base);
  const a = await getAccount({ api_key: process.env.SERPAPI_API_KEY }); // free, uncounted
  return json({ ...base, account: { plan: a.plan_name, left: a.total_searches_left, thisMonth: a.this_month_usage } });
}
