"use client";
// Chrome's built-in AI (on-device, free, no key). Pure progressive enhancement: every step is
// feature-detected, time-boxed, and silently skipped when unavailable.
//  • Translator + LanguageDetector (stable since Chrome 138): memories typed in an Indic script → English.
//  • Prompt API / Gemini Nano (Chrome 148+, capable hardware): memory → search descriptors + queries.
// Only models already on the device are used; we never start a multi-GB download on someone's behalf.
import type { DishClass } from "./types";

export interface AIHints {
  translated?: string;
  descriptors?: string[];
  queries?: string[];
  dishClass?: DishClass;
  by: ("translator" | "gemini-nano")[];
}

type Avail = "available" | "downloadable" | "downloading" | "unavailable";
type AnyApi = { availability(o?: unknown): Promise<Avail>; create(o?: unknown): Promise<any> };
const api = (name: string) => (globalThis as unknown as Record<string, AnyApi | undefined>)[name];

const within = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
const INDIC = /[ऀ-෿]/; // Devanagari … Malayalam

async function translate(text: string): Promise<string | null> {
  const Detector = api("LanguageDetector");
  const Translator = api("Translator");
  if (!Detector || !Translator || !INDIC.test(text)) return null;
  if ((await Detector.availability()) !== "available") return null;
  const [top] = await (await Detector.create()).detect(text);
  if (!top || top.detectedLanguage === "en" || top.confidence < 0.5) return null;
  const pair = { sourceLanguage: top.detectedLanguage, targetLanguage: "en" };
  if ((await Translator.availability(pair)) !== "available") return null;
  return (await (await Translator.create(pair)).translate(text)) || null;
}

const SCHEMA = {
  type: "object",
  properties: {
    dishClass: { type: "string", enum: ["sweet", "snack", "savory", "drink", "remedy", "offering", "unknown"] },
    descriptors: { type: "array", items: { type: "string" }, maxItems: 8 },
    queries: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 2 },
  },
  required: ["dishClass", "descriptors", "queries"],
};

async function nano(text: string) {
  const LM = api("LanguageModel");
  if (!LM) return null;
  const io = { expectedInputs: [{ type: "text", languages: ["en"] }], expectedOutputs: [{ type: "text", languages: ["en"] }] };
  if ((await LM.availability(io)) !== "available") return null;
  const session = await LM.create({
    ...io,
    initialPrompts: [
      {
        role: "system",
        content:
          "You turn someone's childhood memory of an Indian festive food (often Hinglish) into Google search intent. " +
          "Never name a dish they did not name. descriptors: up to 8 short English food descriptors (ingredients, texture, shape, cooking method). " +
          "queries: exactly 2 Google queries (max 12 words) that would find recipe pages naming this dish; each must contain the word 'recipe'.",
      },
    ],
  });
  try {
    const out = JSON.parse(await session.prompt(text, { responseConstraint: SCHEMA }));
    return out as { dishClass: DishClass; descriptors: string[]; queries: string[] };
  } finally {
    session.destroy?.();
  }
}

/** Best effort, ≤ ~6 s total. Returns null when Chrome's built-in AI isn't there. */
export async function understandMemory(text: string): Promise<AIHints | null> {
  const by: AIHints["by"] = [];
  let english = text;
  try {
    const translated = await within(translate(text), 3000);
    if (translated) {
      english = translated;
      by.push("translator");
    }
  } catch {}
  let parsed: Awaited<ReturnType<typeof nano>> = null;
  try {
    parsed = await within(nano(english), 5000);
    if (parsed) by.push("gemini-nano");
  } catch {}
  if (!by.length) return null;
  return { translated: english !== text ? english : undefined, ...(parsed ?? {}), by };
}
