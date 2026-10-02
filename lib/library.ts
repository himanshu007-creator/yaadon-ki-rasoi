import fs from "node:fs";
import path from "node:path";
import { descriptorsOf } from "./agent/parse";
import { hasPhrase, norm } from "./text";
import type { LibraryEntry, ParsedMemory } from "./types";

export const GATE_A =
  "Nani Diwali pe ek gol si mithai banati thi. Gud ki smell, upar til, bahar thodi crispy aur andar soft. Lohe ki kadhai mein tel mein talti thi. Naam bilkul yaad nahi.";

const DIR = path.join(process.cwd(), "fixtures", "library");
let cache: LibraryEntry[] | null = null;

export function library(): LibraryEntry[] {
  if (cache && process.env.NODE_ENV === "production") return cache;
  try {
    cache = fs
      .readdirSync(DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) as LibraryEntry)
      .sort((a, b) => a.slug.localeCompare(b.slug));
  } catch {
    cache = [];
  }
  return cache;
}

export const libraryEntry = (slug: string) => library().find((e) => e.slug === slug);

/** Library entry for a dish name (or one of its aliases), used to back-fill a failed live scene. */
export function libraryFor(name: string) {
  return library().find((e) => {
    const c = e.candidates.find((c) => c.id === e.confirmedId);
    return c && [c.name, ...c.aliases].some((n) => norm(n) === norm(name));
  });
}

/** Closest recorded memory: named dish > descriptor overlap > region. */
export function closest(text: string, parsed?: ParsedMemory) {
  const lib = library();
  if (!lib.length) return undefined;
  const mine = new Set(parsed?.descriptors ?? descriptorsOf(text).descriptors);
  const scored = lib.map((e) => {
    const c = e.candidates.find((c) => c.id === e.confirmedId);
    const named = c && [c.name, ...c.aliases].some((n) => hasPhrase(text, n)) ? 10 : 0;
    const theirs = descriptorsOf(e.seed.text).descriptors;
    const overlap = theirs.filter((d) => mine.has(d)).length;
    const region = parsed?.regionHints.includes(e.seed.regionHint ?? "") ? 1 : 0;
    return { e, s: named + overlap + region };
  });
  return scored.sort((a, b) => b.s - a.s)[0].e;
}
