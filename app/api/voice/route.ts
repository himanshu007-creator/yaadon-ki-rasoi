import path from "node:path";
import fs from "node:fs/promises";
import { speak } from "@/lib/cartesia";
import { deployMode } from "@/lib/context";
import { DATA_DIR } from "@/lib/disk";
import { clientIp, rateLimit } from "@/lib/store";
import { clipKey, clipUrl, LINES, type Lang } from "@/lib/voices";

export const runtime = "nodejs";

// Shipped clips are served statically; anything else is generated once (if a Cartesia key is set) and cached.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const lang = u.searchParams.get("lang") as Lang;
  const dish = (u.searchParams.get("dish") ?? "").trim().slice(0, 40);
  if (!(lang in LINES) || !/^[\p{L} '-]{2,40}$/u.test(dish)) return new Response("Bad request", { status: 400 });
  const shipped = clipUrl(lang, dish);
  if (shipped) return Response.redirect(new URL(shipped, req.url), 302);
  // Public deploys only play shipped clips, so visitors can't spend the owner's Cartesia credits.
  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey || deployMode()) return new Response("No voice", { status: 404 });
  const file = path.join(DATA_DIR, "voices", `${clipKey(lang, dish)}.mp3`);
  let bytes = await fs.readFile(file).catch(() => null);
  if (!bytes) {
    if (!rateLimit(`voice:${clientIp(req)}`, 20, 3600_000)) return new Response("Slow down", { status: 429 });
    bytes = await speak(lang, dish, apiKey);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes);
  }
  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=31536000, immutable" } });
}
