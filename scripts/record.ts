// Records full live investigations of the flagship memories (~12 credits each) into
// fixtures/library/<slug>.json (+ raw responses in fixtures/serpapi). These power replay mode
// and the "recorded investigation" fallback.
// Run: npm run record   (all)   ·   npm run record -- anarsa   (one)
process.env.DEMO_MODE = "live";
process.env.RECORD = "1";
process.env.DAILY_CREDIT_CAP ||= "150";

import fs from "node:fs/promises";
import path from "node:path";
import { investigate, reveal } from "../lib/agent/pipeline";
import type { CallMeta } from "../lib/serp";
import { PLACES } from "../lib/places";
import { writeJson } from "../lib/disk";
import { GATE_A } from "../lib/library";
import { stateById } from "../lib/states";
import { norm } from "../lib/text";
import type { Candidate, DishClass, LibraryEntry, MemoryInput, RevealPayloads } from "../lib/types";

if (!process.env.SERPAPI_API_KEY) {
  console.error("Set SERPAPI_API_KEY in .env.local first.");
  process.exit(1);
}

const city = (n: string) => PLACES.find((c) => c.name === n)!;

const FLAGSHIPS: { slug: string; blurb: string; region: string; targets: string[]; seed: MemoryInput }[] = [
  {
    slug: "anarsa", region: "Maharashtra · Bihar · Tamil Nadu · Andhra", targets: ["anarsa", "anarse", "adhirasam", "athirasam", "ariselu", "arisa pitha", "kajjaya"],
    blurb: "Rice flour and jaggery, sesame on top, fried slowly. One sweet with many names.",
    seed: { text: GATE_A, festival: "diwali", maker: "nani", city: city("Bengaluru"), home: city("Gaya"), uiLang: "hinglish" },
  },
  {
    slug: "gujiya", region: "Uttar Pradesh · Maharashtra · Gujarat · Andhra", targets: ["gujiya", "gujia", "karanji", "ghughra", "kajjikayalu", "pedakiya"],
    blurb: "A crimped half-moon pastry filled with khoya and suji, fried in ghee.",
    seed: { text: "Diwali pe Dadi maida ki bhari hui meethi cheez banati thi, andar khoya aur suji, kinare gundh ke, ghee mein talti thi", festival: "diwali", maker: "dadi", regionHint: "UP", city: city("Delhi"), home: city("Kanpur"), uiLang: "hinglish" },
  },
  {
    slug: "pinni", region: "Punjab · Haryana · Himachal", targets: ["pinni", "pinnis", "atta pinni", "panjiri"],
    blurb: "Wheat flour roasted in ghee with gond and nuts, rolled into winter laddoos.",
    seed: { text: "Sardiyon mein Diwali ke baad Nani aata ghee mein bhoon ke gol ladoo banati thi, gond aur badam ke saath, gud wale", festival: "diwali", maker: "nani", regionHint: "PB", city: city("Ludhiana"), home: city("Amritsar"), uiLang: "hinglish" },
  },
];

/** Run one stateless phase and collect what it streamed. */
async function collect(run: (emit: (event: string, data: any) => void) => Promise<unknown>) {
  const events: { event: string; data: any }[] = [];
  await run((event, data) => events.push({ event, data }));
  return events;
}

const only = process.argv[2];
for (const f of FLAGSHIPS.filter((f) => !only || f.slug === only)) {
  console.log(`\n🪔 ${f.slug}`);
  const p1 = await collect((emit) => investigate(f.seed, emit));
  const got = p1.find((e) => ["candidates", "no_match", "error", "recorded"].includes(e.event))!;
  if (got.event !== "candidates" || p1.some((e) => e.event === "recorded")) {
    console.error(`   ✗ ${got.event}`, got.data);
    continue;
  }
  const { items, dishClass } = got.data as { items: Candidate[]; dishClass: DishClass };
  console.log("   candidates:", items.map((c) => `${c.name} (${c.score}) [${c.aliases.join(", ")}]`).join(" · "));
  const pick = items.slice(0, 3).find((c) => [c.name, ...c.aliases].some((n) => f.targets.includes(norm(n))));
  if (!pick) {
    console.error(`   ✗ none of ${f.targets.join("/")} in the top 3 — tweak the seed memory and re-run this one`);
    continue;
  }
  const p2 = await collect((emit) => reveal(f.seed, pick, emit, { dishClass }));
  const rv = Object.fromEntries(p2.filter((e) => e.event === "reveal").map((e) => [e.data.scene, e.data.payload])) as RevealPayloads;
  const calls = [...p1, ...p2].filter((e) => e.event === "call").map((e) => e.data as CallMeta);
  const docs = p1.find((e) => e.event === "stage" && e.data.id === "retrieve" && e.data.status === "ok")?.data.meta;
  const entry: LibraryEntry = {
    slug: f.slug,
    name: pick.name,
    nameNative: pick.nameNative,
    blurb: f.blurb,
    region: f.region,
    seed: f.seed,
    recordedAt: new Date().toISOString(),
    docsCount: docs?.pages ?? 0,
    domains: docs?.domains ?? [],
    candidates: items.slice(0, 3),
    confirmedId: pick.id,
    reveal: rv,
    calls,
  };
  await writeJson(path.join(process.cwd(), "fixtures", "library", `${f.slug}.json`), entry);
  if (f.slug === "anarsa") await refreshDemoFamily(entry);
  const credits = calls.reduce((s, c) => s + c.credits, 0);
  console.log(`   ✓ ${pick.name} · states ${Object.keys(rv.aliases?.byState ?? {}).length} · heartbeat ${rv.heartbeat ? "yes" : "no"} · steps ${rv.steps?.steps.length ?? 0} · shops ${rv.shops?.shops.length ?? 0} · ${credits} credits`);
}
process.exit(0);

// The seeded demo family shows the real recorded dish, names and steps.
async function refreshDemoFamily(e: LibraryEntry) {
  const file = path.join(process.cwd(), "fixtures", "demo-family.json");
  const fam = JSON.parse(await fs.readFile(file, "utf8"));
  const c = e.candidates.find((x) => x.id === e.confirmedId)!;
  fam.dish = { name: c.name, nameNative: c.nameNative, aliases: c.aliases, photo: c.photo };
  fam.names = Object.entries(e.reveal.aliases?.byState ?? {})
    .sort((a, b) => b[1].share - a[1].share)
    .map(([id, v]) => ({ state: stateById(id)?.name ?? id, name: v.name }))
    .slice(0, 8);
  fam.steps = e.reveal.steps ?? null;
  await writeJson(file, fam);
}
