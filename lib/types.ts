import type { CallMeta } from "./serp";

export const FESTIVALS = [
  "diwali", "dhanteras", "bhai-dooj", "chhath", "durga-puja", "navratri", "kali-puja",
  "pongal", "onam", "lohri", "holi", "eid", "christmas", "other",
] as const;
export type Festival = (typeof FESTIVALS)[number];

export const MAKERS = ["nani", "dadi", "maa", "papa", "other"] as const;
export type Maker = (typeof MAKERS)[number];

export type UiLang = "hinglish" | "en";

export interface City {
  name: string;
  lat: number;
  lng: number;
  state?: string;
}

export interface MemoryInput {
  text: string;
  festival: Festival;
  maker?: Maker;
  regionHint?: string; // state id, e.g. "MH"
  remembered?: boolean;
  city?: City; // where the user is now
  home?: City; // where the maker lived
  uiLang: UiLang;
  /** From Chrome's on-device AI in the visitor's browser, if it was available. */
  hints?: { translated?: string; descriptors?: string[]; queries?: string[]; dishClass?: DishClass; by: string[] };
}

export type DishClass = "sweet" | "snack" | "savory" | "drink" | "remedy" | "offering" | "unknown";

export interface ParsedMemory {
  dishClass: DishClass;
  descriptors: string[];
  descriptorsNative: string[];
  regionHints: string[];
  queries: string[];
}

export interface Doc {
  id: string;
  domain: string;
  url: string;
  title: string;
  snippet: string;
  kind: "organic" | "recipe" | "qa" | "kg";
  thumb?: string;
}

export interface Photo {
  thumb: string;
  source: string;
  link: string;
}

export interface Candidate {
  id: string;
  name: string;
  nameNative?: string;
  aliases: string[];
  supportDocIds: string[];
  matched: string[];
  domains: string[];
  score: number;
  photo?: Photo;
}

export interface AliasMap {
  names: string[];
  byState: Record<string, { name: string; share: number }>;
}

export interface Heartbeat {
  term: string;
  points: { t: number; v: number }[];
  peaks: { t: number; v: number }[];
  festiveYears: number;
  years: number;
}

export interface StepsPack {
  videoId: string;
  title: string;
  channel: string;
  mode: "ai-summary" | "verbatim";
  ingredients: { name: string; qty?: string }[];
  steps: { n: number; text: string; startMs: number }[];
}

export interface Shop {
  title: string;
  dataId: string;
  rating?: number;
  reviews?: number;
  address?: string;
  gps: { lat: number; lng: number };
  distanceKm: number;
  phone?: string;
  openState?: string;
  thumb?: string;
  mentions: number;
  heritageScore: number;
  quote?: { text: string; date?: string; link: string };
}

export interface ShopsPack {
  city: string;
  shops: Shop[];
}

export type Scene = "aliases" | "heartbeat" | "steps" | "shops";

export interface RevealPayloads {
  aliases?: AliasMap | null;
  heartbeat?: Heartbeat | null;
  steps?: StepsPack | null;
  shops?: ShopsPack | null;
}

export interface StageEvent {
  id: string;
  status: "start" | "ok" | "skip" | "fail";
  meta?: Record<string, unknown>;
}

/** A whole recorded investigation: powers replay mode and the recorded fallback. */
export interface LibraryEntry {
  slug: string;
  name: string;
  nameNative?: string;
  blurb: string;
  region: string;
  seed: MemoryInput;
  recordedAt: string;
  docsCount: number;
  domains: string[];
  candidates: Candidate[];
  confirmedId: string;
  reveal: RevealPayloads;
  calls: CallMeta[];
}

/** The single refine question, asked by the client when all candidates are rejected. */
export const QUESTIONS: Record<string, string[]> = {
  cook: ["deep fried", "roasted", "steamed", "sugar syrup"],
  shape: ["round", "spiral", "stuffed", "flat"],
  base: ["rice flour", "gram flour", "semolina", "wheat flour", "coconut"],
  taste: ["sweet", "savory"],
};
export const REFINE_OPTIONS = Object.values(QUESTIONS).flat();
