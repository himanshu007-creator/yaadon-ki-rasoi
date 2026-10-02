// Pre-generates the grandmother lines for every language that appears on the recorded flagship maps.
// Run: npm run voices   (needs CARTESIA_API_KEY in .env.local)
import fs from "node:fs/promises";
import path from "node:path";
import { speak } from "../lib/cartesia";
import { library } from "../lib/library";
import { byLanguage, clipKey } from "../lib/voices";

const key = process.env.CARTESIA_API_KEY;
if (!key) {
  console.error("Set CARTESIA_API_KEY in .env.local first.");
  process.exit(1);
}

const manifestFile = path.join(process.cwd(), "fixtures", "voices.json");
const manifest: Record<string, string> = JSON.parse(await fs.readFile(manifestFile, "utf8"));
await fs.mkdir(path.join(process.cwd(), "public", "voices"), { recursive: true });

for (const e of library()) {
  for (const [lang, { dish }] of byLanguage(e.reveal.aliases?.byState ?? {})) {
    const k = clipKey(lang, dish);
    if (manifest[k]) continue;
    const bytes = await speak(lang, dish, key);
    await fs.writeFile(path.join(process.cwd(), "public", "voices", `${k}.mp3`), bytes);
    manifest[k] = `/voices/${k}.mp3`;
    console.log(`🎙  ${e.slug} · ${lang} · ${dish} (${Math.round(bytes.length / 1024)} KB)`);
  }
}
await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 1) + "\n");
console.log(`${Object.keys(manifest).length} clips in fixtures/voices.json`);
