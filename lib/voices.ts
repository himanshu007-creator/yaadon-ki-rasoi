// A grandmother's line per language, spoken by a soft native voice (Cartesia Sonic).
// Lines are hand-written; please have a native speaker review before a public launch.
import manifest from "@/fixtures/voices.json";
import { norm, titleCase } from "./text";

export type Lang = "hi" | "ta" | "te" | "bn" | "mr" | "gu" | "kn" | "ml" | "pa" | "or";

export const STATE_LANG: Record<string, Lang> = {
  TN: "ta", PY: "ta", AP: "te", TG: "te", WB: "bn", TR: "bn", MH: "mr", GA: "mr", GJ: "gu", DH: "gu",
  KA: "kn", KL: "ml", LD: "ml", PB: "pa", CH: "pa", OD: "or",
};
export const langOf = (stateId: string): Lang => STATE_LANG[stateId] ?? "hi";

export const LANG_NAME: Record<Lang, string> = {
  hi: "Hindi", ta: "Tamil", te: "Telugu", bn: "Bengali", mr: "Marathi", gu: "Gujarati", kn: "Kannada", ml: "Malayalam", pa: "Punjabi", or: "Odia",
};

// Soft / mature native female voices from Cartesia's library.
export const VOICE_ID: Record<Lang, string> = {
  hi: "56e35e2d-6eb6-4226-ab8b-9776515a7094", // Kavita — mature Indian female
  ta: "4014f0c9-d3eb-4eca-af2b-fd6004f526be", // Meena — steady, grounding
  te: "76961778-5ce4-4aa9-9cdf-66a029d61a8f", // Bhavani — soft, caring
  bn: "59ba7dee-8f9a-432f-a6c0-ffb33666b654", // Pooja — soft-spoken
  mr: "5c32dce6-936a-4892-b131-bafe474afe5f", // Anika
  gu: "4590a461-bc68-4a50-8d14-ac04f5923d22", // Isha
  kn: "4c00ff98-199c-4967-99ae-7b69125edcff", // Disha
  ml: "b426013c-002b-4e89-8874-8cd20b68373a", // Latha
  pa: "991c62ce-631f-48b0-8060-2a0ebecbd15b", // Jaspreet
  or: "3cd7da94-509d-4a2a-b0f0-67fd39fe4e8e", // Geeta
};

/** Native script (spoken), romanised (shown), and the shared English meaning. {dish} is filled in. */
export const LINES: Record<Lang, { native: string; roman: string }> = {
  hi: {
    native: "हाय राम! {dish} याद आ गया? हमारे यहाँ तो इसे {dish} ही कहते हैं, बेटा... आ, बैठ जा। इस दिवाली गरमा-गरम बनाऊँगी तेरे लिए!",
    roman: "Haay Raam! {dish} yaad aa gaya? Humare yahan toh ise {dish} hi kehte hain, beta… aa, baith ja. Is Diwali garma-garam banaungi tere liye!",
  },
  ta: {
    native: "அய்யோ, கண்ணு! {dish} ஞாபகம் இருக்கா? எங்க ஊர்ல இதுக்கு {dish}-னு தான் பேரு... வா, உட்காரு. இந்த தீபாவளிக்கு சூடா செஞ்சு தரேன்!",
    roman: "Ayyo, kannu! {dish} nyabagam irukka? Enga oorla idhukku {dish}-nu dhaan peru… vaa, utkaaru. Indha Deepavalikku sooda senju tharen!",
  },
  te: {
    native: "అయ్యో, నాన్నా! {dish} గుర్తుందా? మా ఊర్లో దీన్ని {dish} అంటారు... రా, కూర్చో. ఈ దీపావళికి వేడి వేడిగా చేసి పెడతాను!",
    roman: "Ayyo, naanna! {dish} gurtunda? Maa oorlo deenni {dish} antaaru… raa, koorcho. Ee Deepavaliki vedi vedigaa chesi pedataanu!",
  },
  bn: {
    native: "ওমা! {dish} মনে আছে তোর? আমাদের এখানে একে {dish}-ই বলে, সোনা... আয়, বোস। এই দীপাবলিতে গরম গরম বানিয়ে দেব!",
    roman: "Oma! {dish} mone ache tor? Amader ekhane eke {dish}-i bole, shona… aay, bosh. Ei Dipaboli-te gorom gorom baniye debo!",
  },
  mr: {
    native: "अगं बाई! {dish} आठवतंय? आमच्याकडे याला {dish}च म्हणतात, बाळा... ये, बस. या दिवाळीला गरमागरम करून देते!",
    roman: "Aga bai! {dish} aathavtay? Aamchyakade yaala {dish}-ch mhantaat, baala… ye, bas. Ya Diwalila garmagaram karun dete!",
  },
  gu: {
    native: "અરે વાહ, દીકરા! {dish} યાદ છે? અમારે ત્યાં આને {dish} કહે છે... આવ, બેસ. આ દિવાળીએ ગરમાગરમ બનાવી આપું!",
    roman: "Are vaah, dikra! {dish} yaad chhe? Amaare tyaan aane {dish} kahe chhe… aav, bes. Aa Diwalie garmagaram banavi aapu!",
  },
  kn: {
    native: "ಅಯ್ಯೋ, ಮಗೂ! {dish} ನೆನಪಿದೆಯಾ? ನಮ್ಮ ಊರಲ್ಲಿ ಇದಕ್ಕೆ {dish} ಅಂತಾರೆ... ಬಾ, ಕೂತ್ಕೋ. ಈ ದೀಪಾವಳಿಗೆ ಬಿಸಿಬಿಸಿಯಾಗಿ ಮಾಡಿ ಕೊಡ್ತೀನಿ!",
    roman: "Ayyo, magu! {dish} nenapideya? Namma oorinalli idakke {dish} antaare… baa, kootko. Ee Deepavalige bisibisiyaagi maadi kodteeni!",
  },
  ml: {
    native: "അയ്യോ, മക്കളേ! {dish} ഓർമ്മയുണ്ടോ? ഞങ്ങളുടെ നാട്ടിൽ ഇതിന് {dish} എന്നാ പറയുന്നത്... വാ, ഇരിക്ക്. ഈ ദീപാവലിക്ക് ചൂടോടെ ഉണ്ടാക്കിത്തരാം!",
    roman: "Ayyo, makkale! {dish} ormmayundo? Njangalude naattil ithinu {dish} enna parayunnathu… vaa, irikku. Ee Deepavalikku choodode undaakki tharaam!",
  },
  pa: {
    native: "ਹਾਏ ਮੇਰਿਆ ਰੱਬਾ! {dish} ਯਾਦ ਆ ਗਈ? ਸਾਡੇ ਏਥੇ ਇਹਨੂੰ {dish} ਕਹਿੰਦੇ ਨੇ, ਪੁੱਤਰ... ਆ, ਬਹਿ ਜਾ। ਇਸ ਦੀਵਾਲੀ ਗਰਮ-ਗਰਮ ਬਣਾ ਕੇ ਦਿਆਂਗੀ!",
    roman: "Haaye mereya Rabba! {dish} yaad aa gayi? Saade ethe ihnu {dish} kehnde ne, puttar… aa, beh ja. Is Diwali garam-garam bana ke diyangi!",
  },
  or: {
    native: "ଆରେ ମୋ ଧନ! {dish} ମନେ ଅଛି? ଆମ ଆଡ଼େ ଏହାକୁ {dish} କୁହନ୍ତି... ଆ, ବସ। ଏଇ ଦୀପାବଳିରେ ଗରମ ଗରମ କରି ଦେବି!",
    roman: "Are mo dhana! {dish} mane achhi? Ama aade ehaku {dish} kuhanti… aa, basa. Ei Deepabalire garama garama kari debi!",
  },
};

export const LINE_EN = "Oh my! You remember {dish}? Here we call it {dish}, my child… come, sit. This Diwali I'll make it hot and fresh for you!";

export const fill = (s: string, dish: string) => s.split("{dish}").join(dish);

/** Per language: the name most of that language's states search for, plus the strongest state. */
export function byLanguage(byState: Record<string, { name: string; share: number }>) {
  const out = new Map<Lang, { dish: string; state: string; votes: Map<string, number>; best: number }>();
  for (const [state, v] of Object.entries(byState)) {
    const lang = langOf(state);
    const e = out.get(lang) ?? { dish: v.name, state, votes: new Map(), best: -1 };
    e.votes.set(v.name, (e.votes.get(v.name) ?? 0) + 1);
    if (v.share > e.best) Object.assign(e, { state, best: v.share });
    out.set(lang, e);
  }
  for (const e of out.values()) e.dish = titleCase([...e.votes].sort((a, b) => b[1] - a[1])[0][0]);
  return out;
}
export const clipKey = (lang: Lang, dish: string) => `${lang}-${norm(dish).replace(/ /g, "-")}`;

/** Pre-generated clip shipped in /public, if any. */
export function clipUrl(lang: Lang, dish: string): string | null {
  const key = clipKey(lang, dish);
  return (manifest as Record<string, string>)[key] ?? null;
}
