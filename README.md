# 🪔 Yaadon Ki Rasoi (यादों की रसोई)

**Shazam for the taste of your childhood.**
*What if you could search Google for something you don't know the name of?*

Describe a festive dish you remember but can't name — *"Nani Diwali pe ek gol si mithai banati thi, gud ki smell, upar til…"*. Yaadon Ki Rasoi searches live with SerpApi, shows three real candidates as polaroids, and when you swipe **"Yehi hai!"** it reveals:

- **Ek swaad, N naam** — the dish's regional names, state by state (Google Trends)
- **Aap akele nahi hain** — India's search heartbeat for it since 2004, peaking every Diwali (Google Trends)
- **Kaise banta tha** — steps grounded in a real YouTube video's transcript, each with a timestamp
- **Aaj bhi zinda hai** — old shops near you that still make it, with a stranger's verbatim review line (Google Maps + Reviews)
- **Desh bhar ki naaniyan** — tap a state and a grandmother speaks in that state's language (10 Indian languages, Cartesia AI voices, clearly labelled): *"Ayyo, kannu! Adhirasam nyabagam irukka?…"*
- **Ghar ki doori** — India's official outline with your exact location and Nani's village (any village/town via OpenStreetMap search, or tap the map): *"Nani ka ghar 1,528 km door hai. Par yeh swaad ab bas ek seeti door hai."*
- **Yaad sambhalo** — share even when a link can't travel: a 1080×1350 **Memory Card** PNG (dish, lit India map with its names, "17 of 19 Diwalis", distance to Nani's ghar — drawn art only, no scraped photos) and a small **PDF** (card + recipe sheet with timestamped steps). One-tap sharing to WhatsApp, Instagram (sends the card image itself), Reddit, LinkedIn, X, Facebook, Telegram and email; every link carries `utm_source/medium/campaign/content` and each share fires a Vercel Analytics `share` event.
- **Meri yaadein** — every result is saved to a history in your own browser (IndexedDB) and reopens instantly, with no network or credits. Nothing is stored on a server.
- **Chrome's built-in AI** — on Chrome, a memory typed in Hindi, Tamil, Bengali… is translated on-device (Translator + Language Detector APIs), and where Gemini Nano is available (Prompt API) it turns the memory into search queries on-device. Free, no key, nothing sent to an AI service; skipped silently elsewhere.

## Quick start

```bash
git clone <this repo> && cd yaadon-ki-rasoi
npm i
npm run dev        # http://localhost:3000 — works with no keys (replay mode)
```

With no `SERPAPI_API_KEY` the app runs in **replay** mode: investigations play back real SerpApi responses recorded into `fixtures/`, clearly labelled *"Record ki hui khoj"* with the recording date. Try the demo family at `/f/DEMO-NANI`.

## Use your own key

```bash
cp .env.example .env.local      # add SERPAPI_API_KEY (and optionally ANTHROPIC_API_KEY)
npm run verify                  # The Gate: ~12 credits, writes docs/contract-report.md
npm run record                  # records 3 flagship investigations (~36 credits) into fixtures/
npm run voices                  # grandmother clips per language via Cartesia (needs CARTESIA_API_KEY)
npm run dev                     # now live first (cache → live), recordings only as fallback
DEMO_MODE=replay npm run dev    # demo without spending credits
```

| Env | Default | Meaning |
|---|---|---|
| `SERPAPI_API_KEY` | — | Server-only. Without it: replay mode. |
| `DEMO_MODE` | `hybrid` with a key, `replay` without | `replay` (recordings only) · `live` · `hybrid` (live first, recording if a live call fails) |
| `DAILY_CREDIT_CAP` | 40 | Hard cap of live credits per IST day |
| `PER_IP_LIVE_PER_DAY` | 2 | Live investigations per visitor; the rest are served recorded |
| `ANTHROPIC_API_KEY` | — | Optional. Claude Haiku 4.5 for parsing/extraction/step summaries. Without it, deterministic rules run. |
| `RECORD` | — | `1` saves every live response as a redacted fixture |

## Deploy on Vercel (visitors bring their own key)

```bash
vercel deploy
```

Set these in the Vercel project:

| Variable | Value | Why |
|---|---|---|
| `NEXT_PUBLIC_VERCEL_DEPLOY` | `true` | Public mode: your SerpApi key is never spent. A **🔑 Your key** button explains how to get a free SerpApi key (250 searches/month) and keeps it only in the visitor's browser; it rides along on each search request and is never stored or logged. Without a key, visitors get the recorded investigations. |
| `ANTHROPIC_API_KEY` | optional | Better parsing/extraction; rules work without it. |

The backend is stateless: every step is one streaming `POST` (`/api/investigate`, `/api/reveal`) and the browser holds the state, so it works across serverless instances. [Vercel Analytics](https://vercel.com/docs/analytics) is built in (cookie-less). Grandmother voices are static files: a dish-specific line for the recorded flagships and one generic line per language for every other search, so playback never costs Cartesia credits.

## Feature → SerpApi engine

| Feature | Engine | Why it matters |
|---|---|---|
| Find dishes from a vague memory | `google` (organic, recipes, related questions, knowledge graph) | Evidence with URLs instead of a model's guess |
| Polaroid photo to *recognise* the dish | `google_images` (only when results have no thumbnail) | Recognition beats description |
| Ek swaad, N naam | `google_trends` `GEO_MAP` (compared by state) | Measured search behaviour, not folklore |
| Aap akele nahi hain | `google_trends` `TIMESERIES`, `date=all` | A pulse that peaks every Diwali since 2004 |
| Regional names for the map | `google` (`"<dish> also known as"`) | Names taken only from what pages literally say |
| Kaise banta tha | `youtube` → `youtube_video_transcript` | Steps tied to a real person's video, with timestamps |
| Aaj bhi zinda hai | `google_maps` → `google_maps_reviews` (`query=<dish>`, `query=childhood`) | Proof the shop makes it + a stranger's memory |

Every call is listed in the **"Rasoi ke peeche"** drawer: engine, query, source (live / cache / recorded), credits, ms.

## Architecture

```
Browser ──POST /api/investigate──► pipeline.ts ── parse (rules + optional Claude)
   ▲                                   │          retrieve ×2 (google)
   └──── SSE /events (stage, call, ◄───┤          extract → provenance validator → rank → photos
         candidates, reveal, done)     │   [user swipes "Yehi hai!"]
                                       ├─ aliases (Trends map) → heartbeat (Trends timeline)
                                       ├─ youtube → transcript → grounded steps
                                       └─ maps → reviews → verbatim quote
lib/serp.ts — the only door to SerpApi: app cache → fixture replay → singleflight → daily budget → getJson → record
```

- **Cost:** ~10–12 credits cold, ~2 warm. Identical concurrent searches are coalesced into one call. App cache TTLs: search 24 h, Trends 7 d, transcripts 30 d, Maps 12 h.
- **Degradation ladder:** live → cached → recorded flagship story (labelled with its date). A 429 is disambiguated (throttled vs out of credits) with the free Account API.
- **Storage:** JSON files in `.data/` (zero setup). Swap `lib/store.ts` for Postgres to run multi-instance.

## Anti-hallucination contract

The LLM (optional) may turn a memory into search queries, pick dish names **from retrieved snippets**, and summarise a transcript. Code — not trust — then enforces:

- A dish survives only if its name appears in a retrieved document; aliases survive only if they literally appear in one.
- Every step's timestamp must exist in the transcript (±3 s), with at least 3 steps, or the scene falls back to verbatim transcript lines.
- Review quotes are verbatim sentences (≤ 25 words), linked, never attributed to a named person. No quote qualifies → no quote.
- Trends values are shown as relative interest, never as absolute numbers.

## Privacy & safety

No accounts and no database: history lives only in the visitor's browser (IndexedDB) and can be deleted there. A visitor's SerpApi key is stored only in their browser and passes through the server per search, never stored or logged. Rate limits on every endpoint. Cookie-less analytics only.

## Accessibility & devices

Mobile-first (360 px), two-pane on tablet/desktop. 48 px targets, visible focus, swipe also works with ✓/✕ buttons and ←/→ keys, the map has a state-by-state list, theatre stages are announced with `aria-live`, `prefers-reduced-motion` and Data Saver are honoured, sounds are off by default and never the only signal.

## Tests

```bash
npm test        # cache key, singleflight, redaction, 429 classifier, provenance validator, rank,
                # state codes, heritage score, quote picker, step grounding, live-first order, voices, on-device AI hints
```

## Known limitations

- Open-ended identification works best for well-documented dishes; very local dishes may need the one refine question or fail gracefully.
- The map outline (`@svg-maps/india`) predates the 2019 J&K/Ladakh split, so Ladakh shares the J&K shape.
- The grandmother lines were hand-written in 10 languages and need a native-speaker review.
- Place search uses the free OpenStreetMap Nominatim service (1 request/second, cached).
- In-memory investigation registry and file storage: single Node process.

## AI-assistance disclosure

Built with Claude Code (Anthropic) as a coding assistant. At runtime, Claude Haiku 4.5 is optional and only reads retrieved search results; every output is validated in code.

MIT licensed. See `ATTRIBUTIONS.md`.
