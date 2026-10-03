# Decisions

| Decision | Reason |
|---|---|
| India drawn from `@svg-maps/india` (React-rendered SVG) instead of map tiles | Owner asked for India's correct map. This outline shows J&K (incl. Gilgit-Baltistan, Aksai Chin) and Arunachal as officially depicted; tile maps (OSM/CARTO) don't. Lazy-loaded; pins placed with a calibrated Mercator projection (`lib/geo.ts`, unit-tested). |
| Places via OpenStreetMap Nominatim, proxied and cached | Nani's house is often a village; a fixed city list can't cover it. Tap-the-map fallback for places search can't find. |
| Grandmother voices: Cartesia Sonic 3.6, softest native female voice per language, speed 0.85 | No elderly Indian voices exist in the library; slower, warmer delivery plus hand-written exclamations ("Ayyo, kannu!", "Haay Raam!") carry the age. Clips pre-generated so judges and public visitors need no key. |
| Stateless streaming POSTs instead of an in-memory registry + SSE GET | Serverless instances don't share memory; the browser now holds the investigation state. |
| Card/PDF export with modern-screenshot, not html-to-image | html-to-image hung on this page; modern-screenshot renders the card in about a second. Exports render from untransformed off-screen copies so images are exactly 1080×1350. PDF pages are JPEG (370 KB vs 10 MB as PNG). |
| Key privacy wording: "never stored, logged or shared; passes through our server only to reach SerpApi" | Literally true for this architecture; "nothing is sent to us" would not be. |
| Family pages removed | They needed a database to be reliable on Vercel; a static, key-less public deploy is worth more. History lives in the visitor's IndexedDB instead. |
| Chrome built-in AI as progressive enhancement, not the polyfill | Translator/Language Detector are stable, on-device and free; Prompt API (Gemini Nano) only where Chrome ships it and the model is already downloaded. The official polyfill needs Firebase/Gemini cloud keys, which defeats "free, no key". |
| Bring-your-own SerpApi key in public mode | The owner can't fund public searches; visitors's keys stay in their browser and bypass the daily cap (their credits). |
| JSON files in `.data/` instead of Postgres/Redis | Zero-setup local run for judges; adapters are one file each (`lib/store.ts`, `lib/serp.ts` cache) to swap later. |
| In-memory investigation registry + SSE | One Node process is enough for the demo; reconnects replay from `Last-Event-ID`. |
| No Framer Motion, no chart/map libraries | CSS keyframes + inline SVG keep first-load JS ~120 KB. |
| Sounds synthesised with Web Audio | No asset licensing, ~0 KB. |
| Vitest unit tests + manual browser QA; Playwright not added | Fastest reliable coverage of the logic that matters (validator, Trends mapping, quotes, Teen seeti). |
| Static OG image (`app/opengraph-image.tsx`) | v2 scope: no dynamic OG; romanised text and drawn diya only, never scraped photos. |
| Investigation answers Hinglish + English only | v2 scope. Devanagari appears only for native dish names found in sources. |
| Haiku 4.5 is optional | `none` mode (dictionary parse, rule extraction, verbatim transcript moments) must work for judges with no keys. |
| One refine question, then a "maybe one of these?" list of recorded flagships | Never an apology dead end. |
| Rule-based extraction ranks with Google's own result order (35%) plus descriptor coverage, domains and region | Recipe cards carry titles only; Google's ordering is the strongest signal available without an LLM. Gate A passes (Adhirasam in top 3). |
| Alias discovery: one extra `"<dish> also known as"` search after confirm | Regional names only from what pages literally say ("also known as Ghughra in Gujarat, Karanji in Maharashtra…"). |
| Heartbeat uses the confirmed dish name | The alias that wins most states can be noisy (Ariselu: 0/17); Adhirasam: 17/19 Diwali peaks. |
| Steps: up to 3 videos, regional-language titles skipped | Hindi/English transcripts of Tamil/Telugu videos are machine-translated gibberish. |
| Heritage-shop proof = ≥ 3 reviews mentioning the dish, sorted first | Honest "they make it" signal without inventing anything. |
