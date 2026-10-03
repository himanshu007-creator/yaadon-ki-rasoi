import { clientIp, json, rateLimit, siteUrl } from "@/lib/http";
import { findState } from "@/lib/states";
import type { City } from "@/lib/types";

export const runtime = "nodejs";

// Proxy to OpenStreetMap Nominatim for villages and small towns. Its policy: ≤ 1 request/second,
// a real User-Agent, cache results. https://operations.osmfoundation.org/policies/nominatim/
const NOMINATIM = "https://nominatim.openstreetmap.org";
const UA = `YaadonKiRasoi/1.0 (+${siteUrl()})`;
const cache = new Map<string, City[]>();
let last = 0;
async function politely<T>(fn: () => Promise<T>) {
  const wait = Math.max(0, last + 1100 - Date.now());
  last = Date.now() + wait;
  await new Promise((r) => setTimeout(r, wait));
  return fn();
}

type Hit = { lat: string; lon: string; name?: string; display_name: string; address?: Record<string, string> };

function toCity(h: Hit): City {
  const a = h.address ?? {};
  const place = a.village || a.hamlet || a.suburb || a.neighbourhood || a.town || a.city || h.name || h.display_name.split(",")[0];
  const district = a.state_district || a.county;
  const parts = [place, district !== place ? district : "", a.state].filter(Boolean);
  return { name: parts.join(", ").slice(0, 60), lat: Number(h.lat), lng: Number(h.lon), state: findState(undefined, a.state)?.id };
}

export async function GET(req: Request) {
  if (!rateLimit(`geo:${clientIp(req)}`, 40, 60_000)) return json({ error: "RATE" }, 429);
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") ?? "").trim().slice(0, 80);
  const lat = Number(u.searchParams.get("lat"));
  const lng = Number(u.searchParams.get("lng"));
  const reverse = Number.isFinite(lat) && Number.isFinite(lng) && u.searchParams.has("lat");
  if (!reverse && q.length < 3) return json({ results: [] });
  const key = reverse ? `r:${lat.toFixed(3)},${lng.toFixed(3)}` : `q:${q.toLowerCase()}`;
  if (cache.has(key)) return json({ results: cache.get(key) });

  const url = reverse
    ? `${NOMINATIM}/reverse?format=jsonv2&zoom=14&addressdetails=1&accept-language=en&lat=${lat}&lon=${lng}`
    : `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=in&accept-language=en&q=${encodeURIComponent(q)}`;
  try {
    const res = await politely(() => fetch(url, { headers: { "User-Agent": UA, Referer: u.origin } }));
    if (!res.ok) return json({ results: [] }, 502);
    const body = await res.json();
    const hits: Hit[] = reverse ? (body?.lat ? [body] : []) : body;
    const results = hits.map(toCity).filter((c, i, arr) => arr.findIndex((x) => x.name === c.name) === i);
    cache.set(key, results);
    return json({ results }, 200);
  } catch {
    return json({ results: [] }, 502);
  }
}
