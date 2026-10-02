import { llmExtract } from "../llm";
import { serp, type CallMeta } from "../serp";
import { stateById } from "../states";
import { domainOf, hasPhrase, norm, titleCase, tokenSetRatio, tokens } from "../text";
import type { Candidate, Doc, ParsedMemory } from "../types";
import { descriptorsOf } from "./parse";

export async function retrieve(queries: string[], onCall: (m: CallMeta) => void) {
  const results = await Promise.all(
    queries.slice(0, 2).map((q) =>
      serp("google", { q, gl: "in", hl: "en", google_domain: "google.co.in", device: "mobile" }, "retrieve"),
    ),
  );
  const docs: Doc[] = [];
  const seen = new Set<string>();
  const add = (d: Doc) => {
    const k = d.url || d.id;
    if (seen.has(k) || !d.title) return;
    seen.add(k);
    docs.push(d);
  };
  results.forEach(({ data, meta }, qi) => {
    onCall(meta);
    const kg = data.knowledge_graph;
    if (kg?.title)
      add({ id: `q${qi}-kg`, kind: "kg", title: kg.title, snippet: kg.description ?? "", url: kg.source?.link ?? "", domain: domainOf(kg.source?.link ?? "") || "knowledge graph", thumb: kg.header_images?.[0]?.image });
    for (const [i, r] of (data.recipes_results ?? []).entries())
      add({ id: `q${qi}-r${i}`, kind: "recipe", title: r.title, snippet: (r.ingredients ?? []).join(", ") || `Recipe from ${r.source ?? domainOf(r.link)}`, url: r.link, domain: domainOf(r.link) || r.source, thumb: r.thumbnail });
    for (const r of data.organic_results ?? [])
      add({ id: `q${qi}-o${r.position}`, kind: "organic", title: r.title, snippet: r.snippet ?? "", url: r.link, domain: domainOf(r.link), thumb: r.thumbnail });
    for (const [i, r] of (data.related_questions ?? []).entries())
      add({ id: `q${qi}-a${i}`, kind: "qa", title: r.question, snippet: r.snippet ?? "", url: r.link ?? "", domain: domainOf(r.link ?? "") });
  });
  return docs.slice(0, 30);
}

const GENERIC = new Set(
  ("diwali deepavali festival festive special sweet sweets mithai recipe recipes easy best top indian india traditional homemade how to make made with " +
    "without quick simple instant snack snacks namkeen dish dishes food foods hindi tamil marathi video step by of and the a in for your you at home " +
    "items treats images royalty free connection benefits plant seeds seed sesame til gud jaggery palm rice flour sugar ghee oil wheat gram besan suji " +
    "semolina coconut milk khoya mawa nuts dry fruits crispy soft perfect authentic yummy tasty delicious archives tag energy pure proof from " +
    "spiritual practice kitchen blog channel shorts").split(" "),
);
const isGeneric = (name: string) => [...tokens(name)].every((t) => GENERIC.has(t) || /^\d+$/.test(t));
const FOOD = /recipe|sweet|mithai|dish|snack|fried|jaggery|sugar|flour|ghee|festival|diwali|laddoo|ladoo|food|cook|prasad/i;
const subsetOf = (a: string, b: string) => [...tokens(a)].every((t) => tokens(b).has(t));

const cleanHead = (s: string) =>
  s
    .split(",")[0]
    .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, "")
    .replace(/\b(recipes?|how to make|easy|traditional|homemade|diwali special|special|authentic|perfect|best|quick|style|bihari|maharashtrian|punjabi|bengali|gujarati|rajasthani|andhra|tamil|kerala|south indian|north indian|online|buy|order|price|shop)\b/gi, " ")
    .replace(/[)\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
const dishLike = (s: string) => !!s && s.split(" ").length <= 3 && !isGeneric(s) && !/^the\b|https?|\/\/|\.\.\.|[\d"“”#@]/i.test(s);

/** Deterministic extraction (no LLM): dish names from titles, title "A | B" pairs and "X, also known as Y" lines. */
export function ngramExtract(docs: Doc[]) {
  const found = new Map<string, { name: string; aliases: Set<string> }>();
  const get = (name: string) => found.get(norm(name));
  for (const d of docs) {
    if (d.kind === "qa") continue; // questions rarely start with the name; their text still counts as support
    const first = cleanHead(d.title.split(/\s*[|–—:]\s*|\s+-\s+|\(/)[0]);
    if (!dishLike(first)) continue;
    if (!get(first)) found.set(norm(first), { name: titleCase(first.toLowerCase()), aliases: new Set() });
    // "A | B" in organic titles is usually the site name; only "(B)" and "A / B" are trusted there.
    const rest = d.kind === "organic" ? d.title.split(/\(|\//).slice(1) : d.title.split(/\s*[|–—:/]\s*|\s+-\s+|\(/).slice(1);
    for (const r of rest.map((x) => cleanHead(x.split(/\s*[|–—:]\s*|\s+-\s+/)[0])))
      if (dishLike(r) && r.split(" ").length <= 2 && LATIN.test(r)) get(first)!.aliases.add(titleCase(r.toLowerCase()));
  }
  const NAME = "([A-Z][\\w]+(?:\\s[A-Z][\\w]+)?)";
  const aka = new RegExp(`${NAME},?\\s+(?:also (?:known|called) as|known as|called)\\s+${NAME}`, "g");
  for (const d of docs)
    for (const [, a, b] of `${d.title}. ${d.snippet}`.matchAll(aka)) {
      if (get(a)) get(a)!.aliases.add(b);
      else if (get(b)) get(b)!.aliases.add(a);
    }
  return [...found.values()].map((c) => {
    // "Mawa Anarsa Goli (Anarsa)" → the shorter canonical name wins.
    const short = [...c.aliases].find((a) => subsetOf(a, c.name));
    const name = short ?? c.name;
    const aliases = [...c.aliases].filter((a) => a !== short && !subsetOf(name, a));
    return { name, aliases, supportDocIds: [] as string[], matchedDescriptors: [] as string[] };
  });
}

/** Extra regional names for a confirmed dish, taken only from what the docs literally say. */
export function aliasesFrom(name: string, docs: Doc[]) {
  const found = new Set<string>();
  const same = (x: string) => norm(x) === norm(name);
  for (const c of ngramExtract(docs)) if (same(c.name) || c.aliases.some(same)) [c.name, ...c.aliases].forEach((a) => found.add(a));
  for (const d of docs) {
    const t = `${d.title}. ${d.snippet}`;
    if (!hasPhrase(t, name)) continue;
    for (const [, list] of t.matchAll(NAME_LIST))
      for (const part of list.split(/\s+(?:in different|across|etc)\b/i)[0].split(/,|\s+or\s+|\s+and\s+/)) {
        const a = part.replace(/\s+in\s+.*$/i, "").trim();
        if (a.split(/\s+/).length <= 2 && LATIN.test(a)) found.add(titleCase(a.toLowerCase()));
      }
  }
  return [...found].filter((a) => !same(a) && dishLike(a) && !subsetOf(name, a) && !/^(a|an|the|it)\b/i.test(a)).slice(0, 6);
}
const NAME_LIST = /(?:also (?:known|called|referred to) as|known as|also called|names like)\s+([^.;!?]+)/gi;
const LATIN = /^[A-Za-z][A-Za-z ]*$/;

type Raw = { name: string; nameNative?: string; aliases: string[]; supportDocIds: string[]; matchedDescriptors: string[] };

/**
 * The anti-hallucination contract, in code: a candidate survives only if its name is found
 * in retrieved docs; aliases survive only if they literally appear in a doc; support and
 * matched descriptors are recomputed from the docs rather than trusted.
 */
export function validate(raw: Raw[], docs: Doc[], descriptors: string[]): Omit<Candidate, "id" | "score">[] {
  const text = (d: Doc) => `${d.title}. ${d.snippet}`;
  const out: Omit<Candidate, "id" | "score">[] = [];
  for (const r of raw) {
    const name = r.name.trim();
    if (!name || isGeneric(name)) continue;
    const support = docs.filter((d) => hasPhrase(text(d), name) || tokenSetRatio(name, text(d)) >= 0.99);
    if (!support.length) continue;
    const aliases = [...new Set(r.aliases.map((a) => a.trim()))].filter(
      (a) => a && norm(a) !== norm(name) && !isGeneric(a) && docs.some((d) => hasPhrase(text(d), a)),
    );
    const allSupport = docs.filter((d) => support.includes(d) || aliases.some((a) => hasPhrase(text(d), a)));
    const corpus = allSupport.map(text).join(" ");
    if (!FOOD.test(corpus)) continue;
    const dictHits = descriptorsOf(corpus).descriptors;
    const matched = descriptors.filter((x) => dictHits.includes(x) || hasPhrase(corpus, x));
    const nameNative = r.nameNative && docs.some((d) => text(d).includes(r.nameNative!)) ? r.nameNative : undefined;
    out.push({
      name: titleCase(name),
      nameNative,
      aliases: aliases.map((a) => titleCase(a)).slice(0, 6),
      supportDocIds: allSupport.map((d) => d.id),
      matched,
      domains: [...new Set(allSupport.map((d) => d.domain).filter(Boolean))],
    });
  }
  // Merge near-duplicates: same dish written two ways, one is the other's alias, or a variant ("Karupatti Adhirasam").
  const merged: typeof out = [];
  for (const c of [...out].sort((x, y) => tokens(x.name).size - tokens(y.name).size)) {
    const twin = merged.find(
      (m) => norm(m.name) === norm(c.name) || subsetOf(m.name, c.name) || m.aliases.some((a) => norm(a) === norm(c.name)) || c.aliases.some((a) => norm(a) === norm(m.name)),
    );
    if (!twin) merged.push(c);
    else {
      const variant = subsetOf(twin.name, c.name);
      twin.aliases = [...new Set([...twin.aliases, ...c.aliases, ...(variant ? [] : [c.name])])].filter((a) => norm(a) !== norm(twin.name) && !subsetOf(twin.name, a));
      twin.supportDocIds = [...new Set([...twin.supportDocIds, ...c.supportDocIds])];
      twin.matched = [...new Set([...twin.matched, ...c.matched])];
      twin.domains = [...new Set([...twin.domains, ...c.domains])];
      twin.nameNative ??= c.nameNative;
    }
  }
  return merged;
}

/** Google's own ordering: dish cards (knowledge graph, recipes) first, then organic results by position. */
function googleRank(docId: string) {
  const m = docId.match(/^q\d+-(kg|r|o|a)(\d*)$/);
  if (!m) return 0;
  const n = Number(m[2] || 0);
  return m[1] === "kg" ? 1 : m[1] === "r" ? 1 - n * 0.08 : m[1] === "o" ? Math.max(0, 0.7 - n * 0.06) : 0.2;
}

export function rank(cands: Omit<Candidate, "id" | "score">[], parsed: ParsedMemory, docs: Doc[]): Candidate[] {
  const regionNames = parsed.regionHints.map((id) => stateById(id)?.name).filter(Boolean) as string[];
  const scored = cands.map((c) => {
    const coverage = parsed.descriptors.length ? c.matched.length / parsed.descriptors.length : 0.5;
    const docSupport = Math.min(1, c.domains.length / 4);
    const sup = docs.filter((d) => c.supportDocIds.includes(d.id)).map((d) => `${d.title} ${d.snippet}`).join(" ");
    const regionFit = regionNames.length ? (regionNames.some((r) => hasPhrase(sup, r)) ? 1 : 0.4) : 0.7;
    const searchRank = Math.max(0, ...c.supportDocIds.map(googleRank));
    const score = 0.3 * coverage + 0.2 * docSupport + 0.15 * regionFit + 0.35 * searchRank;
    return { ...c, score: Math.round(score * 100) / 100 };
  });
  return scored.sort((a, b) => b.score - a.score).map((c, i) => ({ ...c, id: `c${i + 1}` }));
}

export async function extract(docs: Doc[], parsed: ParsedMemory) {
  const llm = await llmExtract(docs, parsed.descriptors);
  const raw = llm?.candidates?.length ? llm.candidates : ngramExtract(docs);
  return { cands: rank(validate(raw, docs, parsed.descriptors), parsed, docs), usedLlm: !!llm?.candidates?.length };
}

/** Cheapest photo first: thumbnails already in the search results, then 1 Google Images call. */
export async function addPhotos(cands: Candidate[], docs: Doc[], onCall: (m: CallMeta) => void, maxSearches = 3) {
  await Promise.all(
    cands.map(async (c, i) => {
      const d = docs.find((d) => c.supportDocIds.includes(d.id) && d.thumb && hasPhrase(d.title, c.name));
      if (d?.thumb) {
        c.photo = { thumb: d.thumb, source: d.domain, link: d.url };
        return;
      }
      if (i >= maxSearches) return;
      try {
        const { data, meta } = await serp("google_images", { q: `${c.name} indian food`, gl: "in", hl: "en", tbs: "itp:photos" }, "images");
        onCall(meta);
        const img = data.images_results?.[0];
        if (img?.thumbnail) c.photo = { thumb: img.thumbnail, source: img.source ?? domainOf(img.link), link: img.link };
      } catch {
        /* a polaroid without a photo still works */
      }
    }),
  );
  return cands;
}
