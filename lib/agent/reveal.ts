import { haversineKm } from "../geo";
import { llmSteps } from "../llm";
import { aliasesFrom, retrieve } from "./candidates";
import { serp, type CallMeta } from "../serp";
import { findState } from "../states";
import { hasPhrase, norm } from "../text";
import type { AliasMap, Candidate, City, DishClass, Heartbeat, Shop, ShopsPack, StepsPack, UiLang } from "../types";

type OnCall = (m: CallMeta) => void;

/* ---------- ALIASES: Trends GEO_MAP (compared breakdown by state) ---------- */

export function aliasMapFrom(rows: any[], names: string[]): AliasMap {
  const byState: AliasMap["byState"] = {};
  const used = new Set<string>();
  for (const r of rows ?? []) {
    const st = findState(r.geo, r.location);
    const vals: { query: string; extracted_value: number }[] = r.values ?? [];
    if (!st || !vals.length) continue;
    const best = vals.reduce((a, b) => ((b.extracted_value ?? 0) > (a.extracted_value ?? 0) ? b : a));
    if (!best.extracted_value) continue;
    byState[st.id] = { name: best.query, share: best.extracted_value };
    used.add(best.query);
  }
  return { names: names.filter((n) => used.has(n)), byState };
}

export function singleMapFrom(rows: any[], name: string): AliasMap {
  const byState: AliasMap["byState"] = {};
  for (const r of rows ?? []) {
    const st = findState(r.geo, r.location);
    if (st && r.extracted_value) byState[st.id] = { name, share: r.extracted_value };
  }
  return { names: Object.keys(byState).length ? [name] : [], byState };
}

export async function aliases(c: Candidate, onCall: OnCall): Promise<AliasMap | null> {
  let known = c.aliases;
  if (known.length < 2) {
    const docs = await retrieve([`${c.name} also known as`], onCall);
    known = [...new Set([...aliasesFrom(c.name, docs), ...known])];
  }
  // Trends allows ≤100 chars per term and 2–5 terms for a compared map.
  const names = [c.name, ...known].map((n) => n.toLowerCase().slice(0, 100)).filter((n, i, a) => a.indexOf(n) === i).slice(0, 5);
  const base = { geo: "IN", region: "REGION", date: "today 5-y", tz: -330, include_low_search_volume: true };
  if (names.length >= 2) {
    const { data, meta } = await serp("google_trends", { ...base, q: names.join(","), data_type: "GEO_MAP" }, "trends-map");
    onCall(meta);
    const map = aliasMapFrom(data.compared_breakdown_by_region, names);
    if (Object.keys(map.byState).length) return map;
  }
  const { data, meta } = await serp("google_trends", { ...base, q: names[0], data_type: "GEO_MAP_0" }, "trends-map");
  onCall(meta);
  const map = singleMapFrom(data.interest_by_region, names[0]);
  return Object.keys(map.byState).length ? map : null;
}

/* ---------- HEARTBEAT: Trends TIMESERIES since 2004 ---------- */

export function heartbeatFrom(timeline: any[], term: string): Heartbeat | null {
  const points = (timeline ?? [])
    .map((p) => ({ t: Number(p.timestamp) * 1000, v: Number(p.values?.[0]?.extracted_value ?? 0) }))
    .filter((p) => Number.isFinite(p.t));
  if (points.length < 12 || !points.some((p) => p.v > 0)) return null;
  const byYear = new Map<number, { t: number; v: number }[]>();
  for (const p of points) {
    const y = new Date(p.t).getUTCFullYear();
    byYear.set(y, [...(byYear.get(y) ?? []), p]);
  }
  const peaks: Heartbeat["peaks"] = [];
  let festiveYears = 0;
  let years = 0;
  for (const pts of byYear.values()) {
    if (pts.length < 10) continue; // skip partial years
    const top = pts.reduce((a, b) => (b.v > a.v ? b : a));
    if (!top.v) continue;
    years++;
    const m = new Date(top.t).getUTCMonth();
    if (m === 9 || m === 10) festiveYears++; // Oct–Nov: Diwali season
    peaks.push(top);
  }
  return { term, points, peaks, festiveYears, years };
}

export async function heartbeat(term: string, onCall: OnCall): Promise<Heartbeat | null> {
  const { data, meta } = await serp("google_trends", { q: term.toLowerCase(), data_type: "TIMESERIES", geo: "IN", date: "all", tz: -330 }, "trends-ts");
  onCall(meta);
  return heartbeatFrom(data.interest_over_time?.timeline_data, term);
}

/* ---------- STEPS: YouTube search → transcript → grounded steps ---------- */

export function lengthSec(len?: string) {
  if (!len) return null;
  const parts = len.split(":").map(Number);
  if (parts.some(isNaN)) return null;
  return parts.reduce((a, b) => a * 60 + b, 0);
}

export function rankVideos(videos: any[], names: string[]) {
  const scored = (videos ?? [])
    .filter((v) => v.link?.includes("watch?v="))
    .map((v) => {
      const sec = lengthSec(v.length);
      const titleHit = names.some((n) => hasPhrase(v.title ?? "", n)) ? 2 : 0;
      const lenOk = sec === null || (sec >= 120 && sec <= 25 * 60) ? 1 : -3;
      // Transcripts come back in Hindi/English; a Tamil- or Telugu-titled video gets machine-translated badly.
      const script = /[\u0980-\u0DFF]|\bin (tamil|telugu|kannada|malayalam|bengali|bangla|odia|marathi)\b/i.test(v.title ?? "") ? -3 : 0;
      const views = Math.log10(1 + Number(String(v.views ?? 0).replace(/\D/g, "")));
      return { v, s: titleHit + lenOk + script + views / 3 };
    })
    .sort((a, b) => b.s - a.s);
  return scored.map((x) => x.v);
}

export function chunk(transcript: { start_ms: number; snippet: string }[], windowMs = 20_000) {
  const out: { startMs: number; text: string }[] = [];
  for (const s of transcript ?? []) {
    const last = out[out.length - 1];
    if (last && s.start_ms - last.startMs < windowMs) last.text += ` ${s.snippet}`;
    else out.push({ startMs: s.start_ms, text: s.snippet ?? "" });
  }
  return out.map((c) => ({ ...c, text: c.text.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim() })).filter((c) => c.text);
}

const COOKING = /\b(add|mix|knead|fry|heat|roll|soak|grind|boil|cook|pour|stir|shape|press|roast|dough|ghee|oil|jaggery|sugar|flour|daal\w*|dalen|milao|mila\w*|gundh\w*|tal\w*|garam|bhoon\w*|bhigo\w*|pees\w*|bana\w*|aata|gud|chashni)\b/i;

const COOKING_HI = /डाल|मिला|गूंध|गूँध|तल|गरम|गुड़|चावल|आटा|घी|तेल|पका|भिगो|बना|चीनी|चाशनी|तिल/;
const clip = (text: string) => text.split(" ").slice(0, 22).join(" ") + (text.split(" ").length > 22 ? "…" : "");

/** No-LLM path: verbatim lines from the video where cooking happens, spaced out; else evenly spaced lines. */
export function verbatimMoments(chunks: { startMs: number; text: string }[]) {
  const picked: { startMs: number; text: string }[] = [];
  const usable = chunks.filter((c) => {
    const words = c.text.replace(/\[[^\]]*\]/g, "").split(/\s+/).filter(Boolean);
    return words.length >= 4 && new Set(words).size / words.length > 0.6;
  });
  for (const c of usable) {
    if (!COOKING.test(c.text) && !COOKING_HI.test(c.text)) continue;
    if (picked.length && c.startMs - picked[picked.length - 1].startMs < 45_000) continue;
    picked.push({ startMs: c.startMs, text: clip(c.text) });
    if (picked.length === 7) break;
  }
  if (picked.length >= 3) return picked;
  const step = Math.max(1, Math.floor(usable.length / 6));
  return usable.filter((_, i) => i > 0 && i % step === 0).slice(0, 6).map((c) => ({ startMs: c.startMs, text: clip(c.text) }));
}

/** Grounding check: every step must point at a real moment in the transcript (±3 s). */
export function groundSteps(steps: { text: string; startMs: number }[], chunks: { startMs: number }[]) {
  const ok = steps.filter((s) => chunks.some((c) => Math.abs(c.startMs - s.startMs) <= 3000) && s.text.trim());
  return ok.length >= 3 ? ok.map((s, i) => ({ n: i + 1, text: s.text.trim(), startMs: s.startMs })) : null;
}

export async function steps(c: Candidate, uiLang: UiLang, onCall: OnCall): Promise<StepsPack | null> {
  const yt = await serp("youtube", { search_query: `${c.name} recipe traditional`, gl: "in", hl: "en" }, "yt-search");
  onCall(yt.meta);
  let video: any;
  let chunks: { startMs: number; text: string }[] = [];
  for (video of rankVideos(yt.data.video_results, [c.name, ...c.aliases]).slice(0, 3)) {
    const v = new URL(video.link).searchParams.get("v")!;
    const tr = await serp("youtube_video_transcript", { v, language_code: uiLang === "en" ? "en" : "hi" }, "yt-transcript");
    onCall(tr.meta);
    chunks = chunk(tr.data.transcript);
    if (chunks.length >= 3) break;
  }
  if (!video) return null;
  const videoId = new URL(video.link).searchParams.get("v")!;
  const base = { videoId, title: video.title ?? c.name, channel: video.channel?.name ?? "YouTube" };
  if (chunks.length < 3) return { ...base, mode: "verbatim", ingredients: [], steps: [] };

  const llm = await llmSteps(chunks, c.name, uiLang);
  const grounded = llm && groundSteps(llm.steps, chunks);
  if (grounded) return { ...base, mode: "ai-summary", ingredients: llm.ingredients.slice(0, 14), steps: grounded.slice(0, 8) };
  const moments = verbatimMoments(chunks);
  return { ...base, mode: "verbatim", ingredients: [], steps: moments.map((m, i) => ({ n: i + 1, ...m })) };
}

/* ---------- SHOPS: Maps → Reviews (query = dish) → verbatim quote ---------- */

const HERITAGE = /\b(since|est\.?|established|estd)\b|\b(18|19)\d{2}\b|bhandar|mishthan|misthan|halwai|purana|old|famous|sweets|mithai|ghasitaram|chitale|kandoi/i;

export function heritageScore(s: { reviews?: number; rating?: number; title: string; description?: string; openState?: string }) {
  const normLog = Math.min(1, Math.log10(1 + (s.reviews ?? 0)) / 4); // 10k reviews ≈ 1
  const rating = Math.max(0, Math.min(1, ((s.rating ?? 3.5) - 3.5) / 1.5));
  const hint = HERITAGE.test(`${s.title} ${s.description ?? ""}`) ? 1 : 0;
  const open = /open/i.test(s.openState ?? "") && !/closed/i.test(s.openState ?? "") ? 1 : 0;
  return Math.round((0.4 * normLog + 0.3 * rating + 0.2 * hint + 0.1 * open) * 100) / 100;
}

const NOSTALGIA = /(childhood|bachpan|nani|dadi|nana|dada|grand(mother|father|ma|pa|parents)|\bmom\b|mother|\bmaa\b|reminds|like home|ghar (jaisa|ka)|homemade|old days|years|since|nostalg|memories|growing up|tradition)/i;

/** Verbatim only. Never paraphrased, never attributed to a named person. */
export function pickQuote(reviews: any[], names: string[], requireName = true) {
  const cands: { text: string; likes: number; date?: string; link: string }[] = [];
  for (const r of reviews ?? []) {
    const body: string = r.extracted_snippet?.original ?? r.snippet ?? "";
    for (const sentence of body.split(/(?<=[.!?।])\s+/)) {
      const s = sentence.trim();
      const words = s.split(/\s+/).length;
      if (words < 5 || words > 25 || !NOSTALGIA.test(s)) continue;
      if (requireName && !names.some((n) => hasPhrase(s, n))) continue;
      cands.push({ text: s, likes: Number(r.likes ?? 0), date: r.date, link: r.link });
    }
  }
  return cands.sort((a, b) => b.likes - a.likes)[0];
}

export async function shops(c: Candidate, city: City, dishClass: DishClass, onCall: OnCall): Promise<ShopsPack> {
  const kind = dishClass === "snack" ? "namkeen" : dishClass === "sweet" || dishClass === "unknown" ? "sweets" : "";
  const maps = await serp("google_maps", { type: "search", q: `${c.name} ${kind}`.trim(), ll: `@${city.lat.toFixed(4)},${city.lng.toFixed(4)},13z`, hl: "en" }, "maps");
  onCall(maps.meta);
  const found: Shop[] = (maps.data.local_results ?? [])
    .filter((r: any) => r.gps_coordinates && r.data_id)
    .map((r: any) => {
      const gps = { lat: r.gps_coordinates.latitude, lng: r.gps_coordinates.longitude };
      return {
        title: r.title, dataId: r.data_id, rating: r.rating, reviews: r.reviews, address: r.address, gps,
        distanceKm: Math.round(haversineKm(city, gps) * 10) / 10, phone: r.phone, openState: r.open_state, thumb: r.thumbnail,
        mentions: 0, heritageScore: heritageScore({ ...r, openState: r.open_state }),
      };
    })
    .filter((s: Shop) => s.distanceKm <= 15) // "results are not guaranteed to be within ll"
    .sort((a: Shop, b: Shop) => b.heritageScore - a.heritageScore)
    .slice(0, 3);

  const names = [c.name, ...c.aliases];
  await Promise.all(
    found.slice(0, 2).map(async (s) => {
      try {
        const rv = await serp("google_maps_reviews", { data_id: s.dataId, hl: "en", sort_by: "qualityScore", query: c.name.toLowerCase() }, "reviews");
        onCall(rv.meta);
        const reviews = (rv.data.reviews ?? []).filter((r: any) => names.some((n) => hasPhrase(r.extracted_snippet?.original ?? r.snippet ?? "", n)));
        s.mentions = reviews.length;
        const q = pickQuote(reviews, names) ?? pickQuote(reviews, names, false);
        if (q) s.quote = { text: q.text, date: q.date, link: q.link };
      } catch {}
    }),
  );
  // ≥ 3 reviews naming the dish is our proof the shop actually makes it.
  found.sort((a, b) => Number(b.mentions >= 3) - Number(a.mentions >= 3) || b.mentions - a.mentions || b.heritageScore - a.heritageScore);
  const best = found[0];
  if (best && !best.quote) {
    try {
      const rv = await serp("google_maps_reviews", { data_id: best.dataId, hl: "en", sort_by: "qualityScore", query: "childhood" }, "reviews");
      onCall(rv.meta);
      const q = pickQuote(rv.data.reviews, names, false);
      if (q) best.quote = { text: q.text, date: q.date, link: q.link };
    } catch {}
  }
  return { city: city.name, shops: found };
}

export const sameDish = (a: string, b: string) => norm(a) === norm(b);
