import { z } from "zod";
import { body, json } from "@/lib/http";
import { addContribution, clientIp, getFamily, isOwner, LimitError, LIMITS, setHidden } from "@/lib/store";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ slug: string }> };

const Add = z.object({
  kind: z.enum(["confirm", "note"]),
  name: z.string().trim().min(1).max(LIMITS.name),
  relation: z.string().trim().max(30).optional(),
  body: z.string().trim().max(LIMITS.body).optional(),
});

export async function POST(req: Request, { params }: Ctx) {
  const slug = (await params).slug;
  const b = await body(req, Add);
  if (!b.ok) return b.res;
  const c = b.data;
  if (c.kind === "note" && !c.body) return json({ error: "VALIDATION", fields: { body: ["Write a few words"] } }, 400);
  try {
    const r = await addContribution(slug, c, clientIp(req));
    return r ? json(r, 201) : json({ error: "GONE" }, 404);
  } catch (e) {
    if (e instanceof LimitError) return json({ error: "RATE", reason: e.message }, 429);
    throw e;
  }
}

const Hide = z.object({ id: z.string().max(20), hidden: z.boolean() });

export async function PATCH(req: Request, { params }: Ctx) {
  const f = await getFamily((await params).slug);
  if (!f) return json({ error: "GONE" }, 404);
  if (!isOwner(f, req.headers.get("x-owner-key"))) return json({ error: "FORBIDDEN" }, 403);
  const b = await body(req, Hide);
  if (!b.ok) return b.res;
  return json({ ok: await setHidden(f.slug, b.data.id, b.data.hidden) });
}
