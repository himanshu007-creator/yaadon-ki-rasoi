// Stateless: each call streams its events through `emit`; the browser keeps the state.
import { BudgetExhausted, SerpError } from "../budget";
import { closest, libraryEntry, libraryFor } from "../library";
import { llmParse } from "../llm";
import { norm } from "../text";
import { mode, ReplayMiss, type CallMeta } from "../serp";
import { REFINE_OPTIONS, type Candidate, type DishClass, type MemoryInput, type ParsedMemory, type Scene } from "../types";
import { addPhotos, extract, retrieve } from "./candidates";
import { buildQueries, dictParse } from "./parse";
import { aliases, heartbeat, shops, steps } from "./reveal";

export type Emit = (event: string, data: unknown) => void;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
class NoRecordings extends Error {}
const degradable = (e: unknown) => e instanceof ReplayMiss || e instanceof BudgetExhausted || e instanceof SerpError;

function reasonOf(e: unknown) {
  if (e instanceof BudgetExhausted) return "budget";
  if (e instanceof SerpError) return e.kind === "out-of-credits" ? "budget" : "serpapi";
  return "replay";
}

function fail(emit: Emit, e: unknown) {
  console.error("investigation failed", e);
  const code = e instanceof NoRecordings ? "NO_RECORDINGS" : "INTERNAL";
  emit("error", { code, recoverable: code === "INTERNAL", fallback: "retry", message: e instanceof Error ? e.message : String(e) });
}

const stage = (emit: Emit, id: string, status: "start" | "ok" | "skip" | "fail", meta?: Record<string, unknown>) => emit("stage", { id, status, meta });

export async function parse(input: MemoryInput): Promise<ParsedMemory> {
  const dict = dictParse(input);
  const llm = await llmParse(input);
  if (!llm) return dict;
  const descriptors = [...new Set([...dict.descriptors, ...llm.descriptors.map((d) => d.toLowerCase())])].slice(0, 10);
  return {
    dishClass: llm.dishClass === "unknown" ? dict.dishClass : llm.dishClass,
    descriptors,
    descriptorsNative: [...new Set([...dict.descriptorsNative, ...llm.descriptorsNative])].slice(0, 10),
    regionHints: dict.regionHints,
    queries: llm.queries.length >= 2 ? llm.queries.slice(0, 2) : dict.queries,
  };
}

/* ---------------- Phase 1: memory → candidates ---------------- */

export async function investigate(input: MemoryInput, emit: Emit, opts: { refine?: string | null; exclude?: string[]; forceRecorded?: string } = {}) {
  const sink = (m: CallMeta) => emit("call", m);
  let parsed: ParsedMemory | undefined;
  try {
    stage(emit, "parse", "start");
    parsed = await parse(input);
    if (opts.refine && REFINE_OPTIONS.includes(opts.refine)) {
      parsed.descriptors = [...new Set([...parsed.descriptors, opts.refine])];
      parsed.queries = buildQueries(input.festival, parsed.dishClass, parsed.descriptors, parsed.regionHints);
    }
    stage(emit, "parse", "ok", { words: parsed.descriptorsNative.length ? parsed.descriptorsNative : parsed.descriptors });
    if (opts.forceRecorded) return await playback(input, parsed, emit, opts.forceRecorded);

    stage(emit, "retrieve", "start", { queries: parsed.queries });
    const docs = await retrieve(parsed.queries, sink);
    stage(emit, "retrieve", "ok", { pages: docs.length, domains: [...new Set(docs.map((d) => d.domain).filter(Boolean))].slice(0, 14) });

    stage(emit, "extract", "start");
    const { cands, usedLlm } = await extract(docs, parsed);
    const skip = new Set((opts.exclude ?? []).map(norm));
    const fresh = cands.filter((c) => !skip.has(norm(c.name))).slice(0, 6);
    stage(emit, "extract", "ok", { count: fresh.length, by: usedLlm ? "llm+validator" : "rules+validator" });
    if (!fresh.length) return emit("no_match", {});

    stage(emit, "photos", "start");
    await addPhotos(fresh, docs, sink);
    stage(emit, "photos", "ok");
    emit("candidates", { items: fresh, dishClass: parsed.dishClass, recorded: null });
  } catch (e) {
    if (!degradable(e)) return fail(emit, e);
    if (opts.refine || opts.exclude?.length) return emit("no_match", { reason: reasonOf(e) });
    await playback(input, parsed, emit, reasonOf(e)).catch((err) => fail(emit, err));
  }
}

/** The degradation ladder's last rung: replay a recorded investigation of the closest memory, clearly labelled. */
async function playback(input: MemoryInput, parsed: ParsedMemory | undefined, emit: Emit, reason: string) {
  const entry = closest(input.text, parsed);
  if (!entry) throw new NoRecordings("No recorded investigations. Add SERPAPI_API_KEY and run `npm run record`.");
  emit("recorded", { reason, recordedAt: entry.recordedAt, seed: entry.seed.text, name: entry.name });
  const replayCalls = (tags: string[]) =>
    entry.calls.filter((c) => tags.includes(c.tag)).forEach((c) => emit("call", { ...c, source: "replay", credits: 0, ms: 0, recordedAt: entry.recordedAt }));

  stage(emit, "retrieve", "start");
  await sleep(900);
  replayCalls(["retrieve"]);
  stage(emit, "retrieve", "ok", { pages: entry.docsCount, domains: entry.domains.slice(0, 14) });
  stage(emit, "extract", "start");
  await sleep(700);
  stage(emit, "extract", "ok", { count: entry.candidates.length, by: "recorded" });
  stage(emit, "photos", "start");
  await sleep(500);
  replayCalls(["images"]);
  stage(emit, "photos", "ok");
  emit("candidates", { items: entry.candidates, dishClass: parsed?.dishClass ?? "unknown", recorded: { slug: entry.slug, at: entry.recordedAt, seed: entry.seed.text } });
}

/* ---------------- Phase 2: confirmed dish → four scenes in parallel ---------------- */

const SCENE_TAGS: Record<Scene, string[]> = {
  aliases: ["trends-map", "retrieve"], heartbeat: ["trends-ts"], steps: ["yt-search", "yt-transcript"], shops: ["maps", "reviews"],
};

export async function reveal(input: MemoryInput, c: Candidate, emit: Emit, opts: { dishClass: DishClass; recordedSlug?: string; only?: Scene }) {
  const t0 = Date.now();
  const calls: CallMeta[] = [];
  const sink = (bucket: CallMeta[]) => (m: CallMeta) => (calls.push(m), bucket.push(m), emit("call", m));
  const wanted = (s: Scene) => !opts.only || opts.only === s;

  async function scene<T>(name: Scene, run: (sink: (m: CallMeta) => void) => Promise<T | null>) {
    if (!wanted(name)) return;
    const bucket: CallMeta[] = [];
    stage(emit, name, "start");
    let payload: T | null = null;
    let recordedAt: string | undefined;
    try {
      payload = await run(sink(bucket));
    } catch (e) {
      console.warn(`scene ${name} failed:`, e instanceof Error ? e.message : e);
      const lib = libraryFor(c.name);
      if (lib?.reveal[name] !== undefined) {
        payload = lib.reveal[name] as T;
        recordedAt = lib.recordedAt;
        for (const x of lib.calls.filter((x) => SCENE_TAGS[name].includes(x.tag))) bucket.push({ ...x, source: "replay", credits: 0, ms: 0, recordedAt });
      }
    }
    stage(emit, name, payload ? "ok" : "fail");
    emit("reveal", { scene: name, payload, source: recordedAt ? "recorded" : "live", recordedAt, provenance: bucket });
  }

  try {
    const rec = opts.recordedSlug ? libraryEntry(opts.recordedSlug) : undefined;
    const recC = rec?.candidates.find((x) => x.id === rec.confirmedId);
    if (rec && recC && norm(recC.name) === norm(c.name)) {
      for (const name of ["aliases", "heartbeat", "steps", "shops"] as Scene[]) {
        if (!wanted(name)) continue;
        stage(emit, name, "start");
        await sleep(650);
        const provenance = rec.calls.filter((x) => SCENE_TAGS[name].includes(x.tag)).map((x) => ({ ...x, source: "replay" as const, credits: 0, ms: 0, recordedAt: rec.recordedAt }));
        provenance.forEach((p) => emit("call", p));
        stage(emit, name, rec.reveal[name] ? "ok" : "fail");
        emit("reveal", { scene: name, payload: rec.reveal[name] ?? null, source: "recorded", recordedAt: rec.recordedAt, provenance });
      }
    } else {
      await Promise.all([
        (async () => {
          await scene("aliases", (s) => aliases(c, s));
          await scene("heartbeat", (s) => heartbeat(c.name, s));
        })(),
        scene("steps", (s) => steps(c, input.uiLang, s)),
        input.city
          ? scene("shops", (s) => shops(c, input.city!, opts.dishClass, s))
          : wanted("shops") && emit("reveal", { scene: "shops", payload: null, needCity: true, provenance: [] }),
      ]);
    }
    emit("done", {
      credits: calls.reduce((s, x) => s + x.credits, 0),
      cacheHits: calls.filter((x) => x.source !== "live").length,
      mode: rec ? "recorded" : mode(),
      durationMs: Date.now() - t0,
    });
  } catch (e) {
    fail(emit, e);
  }
}
