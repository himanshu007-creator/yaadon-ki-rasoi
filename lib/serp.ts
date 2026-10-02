// The one door to SerpApi. Nothing else in the codebase imports the SDK's getJson.
import crypto from "node:crypto";
import path from "node:path";
import { getJson } from "serpapi";
import { BudgetExhausted, classify, refund, reserve } from "./budget";
import { currentKey, isByo } from "./context";
import { DATA_DIR, readJson, writeJson } from "./disk";

export type Engine =
  | "google"
  | "google_images"
  | "google_trends"
  | "youtube"
  | "youtube_video_transcript"
  | "google_maps"
  | "google_maps_reviews";

export type Params = Record<string, string | number | boolean>;
export type Source = "live" | "app-cache" | "replay";

export interface CallMeta {
  engine: Engine;
  tag: string;
  source: Source;
  credits: number;
  ms: number;
  params: Params;
  recordedAt?: string;
}

const HOUR = 3600;
export const TTL = {
  retrieve: 24 * HOUR,
  images: 7 * 24 * HOUR,
  "trends-map": 7 * 24 * HOUR,
  "trends-ts": 7 * 24 * HOUR,
  "yt-search": 3 * 24 * HOUR,
  "yt-transcript": 30 * 24 * HOUR,
  maps: 12 * HOUR,
  reviews: 3 * 24 * HOUR,
} as const;
export type Tag = keyof typeof TTL;

export type Mode = "replay" | "live" | "hybrid";
export function mode(): Mode {
  if (!currentKey()) return "replay";
  if (isByo()) return "hybrid";
  const m = process.env.DEMO_MODE as Mode | undefined;
  return m === "replay" || m === "live" || m === "hybrid" ? m : "hybrid";
}

export class ReplayMiss extends Error {
  code = "REPLAY_MISS" as const;
}

/** sha1 of engine + params with sorted keys; never includes the api key. */
export function cacheKey(engine: Engine, params: Params) {
  const canon = Object.keys(params)
    .filter((k) => k !== "api_key")
    .sort()
    .map((k) => `${k}=${String(params[k]).trim().toLowerCase()}`)
    .join("&");
  return crypto.createHash("sha1").update(`${engine}?${canon}`).digest("hex").slice(0, 20);
}

const cacheFile = (key: string) => path.join(DATA_DIR, "cache", `${key}.json`);
export const fixtureFile = (engine: Engine, key: string) =>
  path.join(process.cwd(), "fixtures", "serpapi", engine, `${key}.json`);

interface Fixture {
  engine: Engine;
  params: Params;
  recordedAt: string;
  data: any;
}

/** Strip anything that could carry a key or point back at our account. */
export function redact(data: any) {
  const d = structuredClone(data);
  if (d?.search_metadata) {
    delete d.search_metadata.json_endpoint;
    delete d.search_metadata.raw_html_file;
    delete d.search_metadata.prettify_html_file;
  }
  let s = JSON.stringify(d);
  const k = currentKey();
  if (k) s = s.split(k).join("REDACTED");
  return JSON.parse(s.replace(/api_key=[^&"]+/g, "api_key=REDACTED"));
}

const inflight = new Map<string, Promise<{ data: any; meta: CallMeta }>>();

function log(meta: CallMeta) {
  const s = meta.source === "live" ? `✓ ${meta.credits}cr ${(meta.ms / 1000).toFixed(1)}s` : meta.source;
  console.log(`serpapi ${meta.engine} [${meta.tag}] ${s}`);
}

export async function serp<T = any>(
  engine: Engine,
  params: Params,
  tag: Tag,
): Promise<{ data: T; meta: CallMeta }> {
  const key = cacheKey(engine, params);
  const base = { engine, tag, params };

  const cached = await readJson<{ exp: number; data: T }>(cacheFile(key));
  if (cached && cached.exp > Date.now()) {
    const meta: CallMeta = { ...base, source: "app-cache", credits: 0, ms: 0 };
    log(meta);
    return { data: cached.data, meta };
  }

  const m = mode();
  const recorded = async () => {
    const fx = await readJson<Fixture>(fixtureFile(engine, key));
    if (!fx) return null;
    const meta: CallMeta = { ...base, source: "replay", credits: 0, ms: 0, recordedAt: fx.recordedAt };
    log(meta);
    return { data: fx.data as T, meta };
  };
  if (m === "replay") {
    const r = await recorded();
    if (r) return r;
    throw new ReplayMiss(`${engine} ${key}`);
  }

  // With a key, live comes first; in hybrid mode a recording is only the fallback when live fails.
  try {
    return await liveCall<T>(engine, params, tag, key);
  } catch (e) {
    const r = m === "hybrid" ? await recorded() : null;
    if (r) return r;
    throw e;
  }
}

async function liveCall<T>(engine: Engine, params: Params, tag: Tag, key: string): Promise<{ data: T; meta: CallMeta }> {
  const base = { engine, tag, params };
  const running = inflight.get(key);
  if (running) return running as Promise<{ data: T; meta: CallMeta }>;
  const p = (async () => {
    // The visitor's own key spends their credits, so only the server key is capped.
    if (!isByo() && !(await reserve(1))) throw new BudgetExhausted("Daily SerpApi credit cap reached");
    const t0 = Date.now();
    let data: any;
    try {
      data = await getJson({ engine, api_key: currentKey(), ...params, timeout: 30_000 });
    } catch (e) {
      if (!isByo()) await refund(1); // failed searches aren't charged; keep our ledger honest
      throw await classify(e);
    }
    if (data?.error && !/hasn't returned any results/i.test(data.error)) {
      if (!isByo()) await refund(1);
      throw await classify(data.error);
    }
    await writeJson(cacheFile(key), { exp: Date.now() + TTL[tag] * 1000, data });
    if (process.env.RECORD === "1") {
      const fx: Fixture = { engine, params, recordedAt: new Date().toISOString(), data: redact(data) };
      await writeJson(fixtureFile(engine, key), fx);
    }
    const meta: CallMeta = { ...base, source: "live", credits: 1, ms: Date.now() - t0 };
    log(meta);
    return { data, meta };
  })();
  inflight.set(key, p);
  try {
    return (await p) as { data: T; meta: CallMeta };
  } finally {
    inflight.delete(key);
  }
}
