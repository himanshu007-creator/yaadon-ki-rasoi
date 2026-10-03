# Human-only tasks

1. ~~SerpApi key~~ — done. Gate passed, 3 flagships recorded. Credits left after the build: ~188/250.
3. **Real phones** — test on Android Chrome and iPhone Safari, including opening a shared link from WhatsApp (in-app browser).
4. **Map review** — the outline now follows India's official depiction (`@svg-maps/india`); give it one human look before launch. It predates the Ladakh UT split.
7. **Native-speaker check** of the 10 grandmother lines in `lib/voices.ts` (Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia, Hindi), then `npm run voices` again if any line changes (delete `public/voices/*` + `fixtures/voices.json` first).
8. **Vercel** — import the repo and set `NEXT_PUBLIC_VERCEL_DEPLOY=true` before the first deploy. Nothing else is needed.
5. **Demo video** — record from `docs/demo-script.md` (< 3 min, local run).
6. **Submit** — press "Submit project" on the hackathon site (a draft does not count).
