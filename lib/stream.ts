"use client";
import { ownKeyHeaders } from "./ownKey";

/** POST JSON and read the text/event-stream reply, calling onEvent per event. Resolves when the stream ends. */
export async function postStream(url: string, body: unknown, onEvent: (event: string, data: any) => void, signal?: AbortSignal) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...ownKeyHeaders() }, body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const event = block.match(/^event: (.*)$/m)?.[1];
      const data = block.match(/^data: (.*)$/m)?.[1];
      if (event && data) onEvent(event, JSON.parse(data));
    }
  }
}

/** Hand a memory to the search page (state lives in the browser, so nothing is lost between serverless calls). */
export function startSearch(input: unknown) {
  try {
    sessionStorage.setItem("yr-search", JSON.stringify(input));
  } catch {}
}
