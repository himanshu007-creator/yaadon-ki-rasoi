import path from "node:path";
import { getAccount } from "serpapi";
import { currentKey } from "./context";
import { DATA_DIR, readJson, withLock, writeJson } from "./disk";

const FILE = path.join(DATA_DIR, "budget.json");
const cap = () => Number(process.env.DAILY_CREDIT_CAP || 40);

/** Calendar day in IST (UTC+5:30) — the cap resets at Indian midnight. */
export function istDay(now = Date.now()) {
  return new Date(now + 330 * 60_000).toISOString().slice(0, 10);
}

type Ledger = Record<string, number>;

export function reserve(n = 1): Promise<boolean> {
  return withLock(FILE, async () => {
    const l = (await readJson<Ledger>(FILE)) ?? {};
    const day = istDay();
    if ((l[day] ?? 0) + n > cap()) return false;
    await writeJson(FILE, { [day]: (l[day] ?? 0) + n });
    return true;
  });
}

export function refund(n = 1) {
  return withLock(FILE, async () => {
    const l = (await readJson<Ledger>(FILE)) ?? {};
    const day = istDay();
    await writeJson(FILE, { [day]: Math.max(0, (l[day] ?? 0) - n) });
  });
}

export async function usedToday() {
  return ((await readJson<Ledger>(FILE)) ?? {})[istDay()] ?? 0;
}

export class BudgetExhausted extends Error {
  code = "BUDGET" as const;
}
export class SerpError extends Error {
  code = "SERPAPI" as const;
  constructor(msg: string, public kind: "out-of-credits" | "throttled" | "other" = "other") {
    super(msg);
  }
}

/**
 * SerpApi returns 429 both for "hourly throughput exceeded" and "out of searches".
 * The free Account API tells them apart.
 */
export async function classify(raw: unknown): Promise<SerpError> {
  let msg = raw instanceof Error ? raw.message : String(raw);
  try {
    msg = JSON.parse(msg).error ?? msg;
  } catch {}
  const key = currentKey();
  if (/run out|limit|exceed|throughput/i.test(msg) && key) {
    try {
      const acc = await getAccount({ api_key: key });
      return new SerpError(msg, Number(acc.total_searches_left) <= 0 ? "out-of-credits" : "throttled");
    } catch {}
  }
  return new SerpError(msg);
}
