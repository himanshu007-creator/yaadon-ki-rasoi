import { json } from "@/lib/http";
import { deleteFamily, getFamily, isOwner, publicView } from "@/lib/store";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ slug: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const f = await getFamily((await params).slug);
  if (!f) return json({ error: "GONE" }, 404);
  return json(publicView(f, isOwner(f, req.headers.get("x-owner-key"))));
}

export async function DELETE(req: Request, { params }: Ctx) {
  const f = await getFamily((await params).slug);
  if (!f) return json({ error: "GONE" }, 404);
  if (!isOwner(f, req.headers.get("x-owner-key"))) return json({ error: "FORBIDDEN" }, 403);
  await deleteFamily(f.slug);
  return json({ ok: true });
}
