import { cookies } from "next/headers";
import { z } from "zod";
import { STATES } from "./states";
import { FESTIVALS, MAKERS, type UiLang } from "./types";

export const json = (data: unknown, status = 200) => Response.json(data, { status });

export async function body<T extends z.ZodType>(req: Request, schema: T): Promise<{ ok: true; data: z.infer<T> } | { ok: false; res: Response }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, res: json({ error: "VALIDATION", message: "Body must be JSON" }, 400) };
  }
  const r = schema.safeParse(raw);
  if (!r.success) return { ok: false, res: json({ error: "VALIDATION", fields: z.flattenError(r.error).fieldErrors }, 400) };
  return { ok: true, data: r.data };
}

/** The public origin: SITE_URL if set, else Vercel's own production/preview domain, else localhost. */
export function siteUrl() {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return process.env.SITE_URL || (host ? `https://${host}` : "http://localhost:3000");
}

export const CitySchema = z.object({
  name: z.string().trim().min(1).max(60),
  lat: z.number().min(6).max(38),
  lng: z.number().min(68).max(98),
  state: z.string().max(4).optional(),
});

export async function serverLang(): Promise<UiLang> {
  return (await cookies()).get("lang")?.value === "en" ? "en" : "hinglish";
}

export const InputSchema = z.object({
  text: z.string().trim().min(8).max(2000).transform((s) => s.slice(0, 600)),
  festival: z.enum(FESTIVALS).default("diwali"),
  maker: z.enum(MAKERS).optional(),
  regionHint: z.enum(STATES.map((s) => s.id) as [string, ...string[]]).optional(),
  remembered: z.boolean().default(false),
  city: CitySchema.optional(),
  home: CitySchema.optional(),
  uiLang: z.enum(["hinglish", "en"]).default("hinglish"),
  hints: z
    .object({
      translated: z.string().trim().max(1200).optional(),
      descriptors: z.array(z.string().trim().max(40)).max(10).optional(),
      queries: z.array(z.string().trim().max(120)).max(2).optional(),
      dishClass: z.enum(["sweet", "snack", "savory", "drink", "remedy", "offering", "unknown"]).optional(),
      by: z.array(z.enum(["translator", "gemini-nano"])).max(2),
    })
    .optional(),
});

// ponytail: in-memory sliding window; resets on restart. Upstash ratelimit when multi-instance.
const hits = new Map<string, number[]>();
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    hits.set(key, arr);
    return false;
  }
  arr.push(now);
  hits.set(key, arr);
  return true;
}

export const clientIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
