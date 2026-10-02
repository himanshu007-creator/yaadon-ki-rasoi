import { z } from "zod";
import { body, json } from "@/lib/http";
import { clientIp, createFamily, rateLimit } from "@/lib/store";
import { FESTIVALS, MAKERS } from "@/lib/types";

export const runtime = "nodejs";

const s = (n: number) => z.string().trim().max(n);
const Schema = z.object({
  ownerName: s(40).min(1),
  maker: z.enum(MAKERS).optional(),
  remembered: z.boolean().default(false),
  festival: z.enum(FESTIVALS).default("diwali"),
  dish: z.object({
    name: s(60).min(1),
    nameNative: s(60).optional(),
    aliases: z.array(s(60)).max(10),
    photo: z.object({ thumb: z.string().url().max(2000), source: s(120), link: s(2000) }).optional(),
  }),
  names: z.array(z.object({ state: s(60), name: s(60) })).max(36),
  steps: z
    .object({
      videoId: z.string().regex(/^[\w-]{6,20}$/),
      title: s(200),
      channel: s(120),
      mode: z.enum(["ai-summary", "verbatim"]),
      ingredients: z.array(z.object({ name: s(80), qty: s(40).optional() })).max(20),
      steps: z.array(z.object({ n: z.number().int(), text: s(400), startMs: z.number().nonnegative() })).max(10),
    })
    .nullable()
    .optional(),
});

export async function POST(req: Request) {
  const b = await body(req, Schema);
  if (!b.ok) return b.res;
  if (!rateLimit(`fam:${clientIp(req)}`, 10, 3600_000)) return json({ error: "RATE" }, 429);
  const { slug, ownerKey } = await createFamily({ ...b.data, steps: b.data.steps ?? null });
  return json({ slug, ownerKey, url: `/f/${slug}` }, 201);
}
