import { STATES, stateById } from "../states";
import type { DishClass, Festival, MemoryInput, ParsedMemory } from "../types";

// Native/Hinglish/Devanagari memory words → English search descriptors.
// Used when no LLM key is set, and to validate what the LLM returns.
const DICT: [RegExp, string][] = [
  [/\b(gud|gur|jaggery|bellam|vellam)\b|गुड़|गुड/i, "jaggery"],
  [/\b(til|sesame|ellu|nuvvulu)\b|तिल/i, "sesame"],
  [/\bbahar\b.{0,20}\b(crispy|kurkur\w*|khasta)\b.{0,20}\bandar\b.{0,12}\b(soft|naram|mulayam)\b|crispy outside|soft inside/i, "crispy outside soft inside"],
  [/\bupar\s+(se\s+)?til\b|\btil\s+(lag|chipk)\w*|sesame (coated|on top)/i, "sesame coated"],
  [/\b(tali|talti|tala|tale|fried|fry|tel mein|kadhai)\b|तली|तलते|कड़ाही/i, "deep fried"],
  [/\b(ghee)\b|घी/i, "ghee"],
  [/\b(besan|gram flour)\b|बेसन/i, "gram flour"],
  [/\b(suji|sooji|rava|rawa|semolina)\b|सूजी/i, "semolina"],
  [/\b(chawal|rice|arisi|biyyam)\b|चावल/i, "rice flour"],
  [/\b(maida|atta|aata|wheat)\b|आटा|मैदा/i, "wheat flour"],
  [/\b(nariyal|coconut|thengai|kobbari)\b|नारियल/i, "coconut"],
  [/\b(khoya|khoa|mawa)\b|खोया|मावा/i, "khoya"],
  [/\b(chashni|chasni|syrup|paag)\b|चाशनी/i, "sugar syrup"],
  [/\b(elaichi|cardamom)\b|इलायची/i, "cardamom"],
  [/\b(kesar|saffron)\b|केसर/i, "saffron"],
  [/\b(badam|kaju|pista|dry ?fruits?|nuts|mewa|meva)\b|मेवा|बादाम|काजू/i, "dry fruits"],
  [/\b(gol|round|ladoo|laddu|ball)\b|गोल|लड्डू/i, "round"],
  [/\b(spiral|chakri|chakli|swirl|ghumawdar)\b/i, "spiral"],
  [/\b(bhara|bhari|stuffed|filling|bharwan)\b|भरा|भरी/i, "stuffed"],
  [/\b(crispy|kurkura|kurkuri|khasta|crunchy)\b|करारा|खस्ता/i, "crispy"],
  [/\b(doodh|milk|paal)\b|दूध/i, "milk"],
  [/\b(namak|namkeen|salty|teekha|spicy|masala)\b|नमकीन|तीखा/i, "savory"],
  [/\b(meetha|meethi|meethe|sweet|mithai)\b|मीठा|मीठी|मिठाई/i, "sweet"],
  [/\b(kheel|khil|batasha|batashe|puffed rice|murmura)\b|खील|बताशा/i, "puffed rice"],
  [/\b(sevai|sewai|seviyan|vermicelli)\b|सेवई/i, "vermicelli"],
  [/\b(moong|dal|lentil)\b|दाल/i, "lentil"],
  [/\b(khus|khaskhas|poppy)\b|खसखस/i, "poppy seeds"],
  [/\b(adrak|sonth|saunth|ginger)\b|अदरक|सोंठ/i, "dry ginger"],
  [/\b(marundhu|legiyam|lehyam|kadha|medicine|digest\w*|dawai)\b|दवाई|काढ़ा/i, "digestive"],
  [/\b(bake[sd]?|oven)\b/i, "baked"],
  [/\b(bhuna|bhuni|bhoon\w*|roast\w*)\b|भुना/i, "roasted"],
  [/\b(steam\w*|bhaap)\b|भाप/i, "steamed"],
  [/\b(khajur|dates)\b|खजूर/i, "dates"],
  [/\b(gajar|carrot)\b|गाजर/i, "carrot"],
  [/\b(flat|chapta|chapti|patla|patli)\b|चपटा/i, "flat"],
  [/\b(diamond|shakarpara|shankarpali)\b/i, "diamond shaped"],
  [/\b(saunf|fennel)\b|सौंफ/i, "fennel"],
  [/\b(gond|edible gum)\b|गोंद/i, "edible gum"],
];

const FESTIVAL_LABEL: Record<Festival, string> = {
  diwali: "Diwali", dhanteras: "Dhanteras", "bhai-dooj": "Bhai Dooj", chhath: "Chhath",
  "durga-puja": "Durga Puja", navratri: "Navratri", "kali-puja": "Kali Puja", pongal: "Pongal",
  onam: "Onam", lohri: "Lohri", holi: "Holi", eid: "Eid", christmas: "Christmas", other: "festival",
};
export const festivalLabel = (f: Festival) => FESTIVAL_LABEL[f] ?? "festival";

export function descriptorsOf(text: string) {
  const out: string[] = [];
  const native: string[] = [];
  for (const [re, en] of DICT) {
    const m = text.match(re);
    if (m && !out.includes(en)) {
      out.push(en);
      native.push(m[0].trim());
    }
  }
  // Keep the richer phrase over its plain word.
  for (const [rich, plain] of [["sesame coated", "sesame"], ["crispy outside soft inside", "crispy"]]) {
    const i = out.indexOf(plain);
    if (out.includes(rich) && i >= 0) {
      out.splice(i, 1);
      native.splice(i, 1);
    }
  }
  return { descriptors: out, descriptorsNative: native };
}

export function classOf(descriptors: string[]): DishClass {
  if (descriptors.includes("digestive")) return "remedy";
  if (descriptors.includes("savory")) return "snack";
  if (descriptors.includes("puffed rice") && !descriptors.includes("deep fried")) return "offering";
  const sweetish = ["sweet", "jaggery", "sugar syrup", "khoya", "dates", "cardamom", "dry fruits", "carrot"];
  return descriptors.some((d) => sweetish.includes(d)) ? "sweet" : "unknown";
}

export function regionsOf(text: string, hint?: string) {
  const t = text.toLowerCase();
  const found = STATES.filter((s) => t.includes(s.name.toLowerCase())).map((s) => s.id);
  return [...new Set([...(hint ? [hint] : []), ...found])].slice(0, 3);
}

/** Two retrieval queries tuned for google.co.in: one "festive", one "name-seeking". */
// Both queries say "recipe": without it, google.co.in returns encyclopedia pages for single ingredients.
export function buildQueries(festival: Festival, dishClass: DishClass, descriptors: string[], regionIds: string[]) {
  const cls = dishClass === "unknown" ? "dish" : dishClass === "remedy" ? "digestive" : dishClass;
  const d = descriptors.filter((x) => !["sweet", "savory", "round"].includes(x));
  const region = stateById(regionIds[0])?.name;
  const words = (s: string) => [...new Set(s.split(/\s+/).filter(Boolean))].join(" ");
  return [
    words(`${festivalLabel(festival)} ${cls} recipe ${d.slice(0, 5).join(" ")}`),
    words(`traditional ${region ?? "Indian"} ${cls} recipe ${d.slice(0, 3).join(" ")} ${descriptors.includes("round") ? "round" : ""}`),
  ];
}

export function dictParse(input: MemoryInput): ParsedMemory {
  const { descriptors, descriptorsNative } = descriptorsOf(input.text);
  const dishClass = classOf(descriptors);
  const regionHints = regionsOf(input.text, input.regionHint);
  return { dishClass, descriptors, descriptorsNative, regionHints, queries: buildQueries(input.festival, dishClass, descriptors, regionHints) };
}
