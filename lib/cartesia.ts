import { fill, LINES, VOICE_ID, type Lang } from "./voices";

/** One soft, slow grandmother line as MP3 bytes. */
export async function speak(lang: Lang, dish: string, apiKey: string) {
  const res = await fetch("https://api.cartesia.ai/tts/bytes", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Cartesia-Version": "2026-08-14", "Content-Type": "application/json" },
    body: JSON.stringify({
      model_id: "sonic-3.6",
      transcript: fill(LINES[lang].native, dish),
      voice: { id: VOICE_ID[lang] },
      language: lang,
      output_format: { container: "mp3", sample_rate: 44100, bit_rate: 128000 },
      generation_config: { speed: 0.85, emotion: "content", volume: 1 },
    }),
  });
  if (!res.ok) throw new Error(`Cartesia ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}
