// The Gate: Gate A (memory → Anarsa) plus one real call per engine (~12 credits).
// Writes docs/contract-report.md and saves every response as a fixture.
// Run: npm run verify   (needs SERPAPI_API_KEY in .env.local)
process.env.DEMO_MODE = "live";
process.env.RECORD = "1";

import fs from "node:fs/promises";
import { extract, retrieve } from "../lib/agent/candidates";
import { parse } from "../lib/agent/pipeline";
import { GATE_A } from "../lib/library";
import { serp } from "../lib/serp";

if (!process.env.SERPAPI_API_KEY) {
  console.error("Set SERPAPI_API_KEY in .env.local first.");
  process.exit(1);
}

let failed = 0;
const report: string[] = [`# Contract report\n\nRun ${new Date().toISOString()} against live SerpApi.\n`];
function check(label: string, ok: unknown, detail?: unknown) {
  if (!ok) failed++;
  const d = detail === undefined ? "" : JSON.stringify(detail).slice(0, 300);
  console.log(`${ok ? "✅" : "❌"} ${label}`, d);
  report.push(`- ${ok ? "✅" : "❌"} **${label}** ${d ? `\`${d}\`` : ""}`);
}
const note = (s: string) => (console.log(`   ${s}`), report.push(`  - ${s}`));

const ANARSA = /anars|adhiras|athiras|arisel|arisa|kajjaya/i;
const parsed = await parse({ text: GATE_A, festival: "diwali", maker: "nani", uiLang: "hinglish" });
note(`queries: ${parsed.queries.join(" | ")}`);
const docs = await retrieve(parsed.queries, () => {});
const { cands } = await extract(docs, parsed);
const top3 = cands.slice(0, 3).map((c) => `${c.name} [${c.aliases.join(", ")}]`);
check("Gate A: Anarsa family in top 3 for the Nani memory", cands.slice(0, 3).some((c) => [c.name, ...c.aliases].some((n) => ANARSA.test(n))), top3);
note(`knowledge_graph docs: ${docs.filter((d) => d.kind === "kg").length} · recipe docs: ${docs.filter((d) => d.kind === "recipe").length} · total docs: ${docs.length}`);

const g = await serp("google", { q: "Diwali sweet rice flour jaggery sesame deep fried", gl: "in", hl: "en", google_domain: "google.co.in", device: "mobile" }, "retrieve");
check("google.organic_results[].{title,link,snippet}", g.data.organic_results?.[0]?.snippet, g.data.organic_results?.[0]?.link);
check("google.recipes_results (optional)", true, g.data.recipes_results?.[0] ?? "absent");
check("google.related_questions (optional)", true, g.data.related_questions?.[0]?.question ?? "absent");

const img = await serp("google_images", { q: "anarsa sweet", gl: "in", hl: "en", tbs: "itp:photos" }, "images");
check("google_images.images_results[].thumbnail", img.data.images_results?.[0]?.thumbnail);

const geo = await serp("google_trends", { q: "anarsa,adhirasam,ariselu", data_type: "GEO_MAP", geo: "IN", region: "REGION", date: "today 5-y", tz: -330, include_low_search_volume: true }, "trends-map");
const rows = geo.data.compared_breakdown_by_region ?? [];
check("trends GEO_MAP compared_breakdown_by_region (geo=IN, region=REGION)", rows.length, rows.slice(0, 3));
note(`state geo codes: ${rows.map((r: any) => `${r.geo}:${r.location}`).join(", ")}`);

const ts = await serp("google_trends", { q: "anarsa", data_type: "TIMESERIES", geo: "IN", date: "all", tz: -330 }, "trends-ts");
const tl = ts.data.interest_over_time?.timeline_data ?? [];
check("trends TIMESERIES timeline_data[].{timestamp,values[].extracted_value}", tl.length && tl[0].values?.[0]?.extracted_value !== undefined, tl[0]);

const yt = await serp("youtube", { search_query: "anarsa recipe traditional", gl: "in", hl: "en" }, "yt-search");
const v = yt.data.video_results?.[0];
check("youtube.video_results[].{title,link,channel}", v?.link, { title: v?.title, channel: v?.channel?.name });
note(`youtube video fields: ${Object.keys(v ?? {}).join(", ")}`);
const vid = v?.link ? new URL(v.link).searchParams.get("v") : null;

if (vid) {
  const tr = await serp("youtube_video_transcript", { v: vid, language_code: "hi" }, "yt-transcript");
  const t = tr.data.transcript ?? [];
  check("youtube_video_transcript.transcript[].{start_ms,snippet}", t[0]?.snippet !== undefined, t[0]);
  note(`transcript keys: ${Object.keys(tr.data).join(", ")} · first: ${JSON.stringify(t[0])}`);
}

const maps = await serp("google_maps", { type: "search", q: "anarsa sweets", ll: "@18.5204,73.8567,13z", hl: "en" }, "maps");
const shop = maps.data.local_results?.[0];
check("google_maps.local_results[].{title,data_id,gps_coordinates}", shop?.data_id && shop?.gps_coordinates, { title: shop?.title, rating: shop?.rating });

if (shop?.data_id) {
  const rv = await serp("google_maps_reviews", { data_id: shop.data_id, hl: "en", sort_by: "qualityScore", query: "anarsa" }, "reviews");
  check("google_maps_reviews (reviews[] optional: absent when no review mentions the dish)", !rv.data.error, rv.data.reviews?.[0]?.snippet ?? "no matching reviews");
}

await fs.mkdir("docs", { recursive: true });
await fs.writeFile("docs/contract-report.md", report.join("\n") + "\n");
console.log(failed ? `\n${failed} contract(s) failed — see docs/contract-report.md` : "\nAll contracts hold. Report: docs/contract-report.md");
process.exit(failed ? 1 : 0);
