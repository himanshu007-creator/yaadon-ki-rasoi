import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// Vercel functions can only write to /tmp (per instance, best-effort): fine for caches, not for families.
export const DATA_DIR = process.env.VERCEL ? "/tmp/yaadon" : path.join(process.cwd(), ".data");

export async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

// Atomic write: temp file + rename, so a crash never leaves half a JSON file.
export async function writeJson(file: string, data: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 1));
  await fs.rename(tmp, file);
}

// ponytail: per-file promise chain as a lock; single process only, use a DB transaction when multi-instance.
const locks = new Map<string, Promise<unknown>>();
export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(key, next.catch(() => {}));
  return next;
}

/* Durable documents (family pages): Upstash/Vercel KV over its REST API when configured, else JSON files. */
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function kv(cmd: unknown[]) {
  const res = await fetch(KV_URL!, { method: "POST", headers: { Authorization: `Bearer ${KV_TOKEN}` }, body: JSON.stringify(cmd), cache: "no-store" });
  if (!res.ok) throw new Error(`KV ${res.status}`);
  return (await res.json()).result;
}
const docFile = (name: string) => path.join(DATA_DIR, `${name}.json`);

export async function loadDoc<T>(name: string): Promise<T | null> {
  if (!KV_URL || !KV_TOKEN) return readJson<T>(docFile(name));
  const v = await kv(["GET", `yr:${name}`]);
  return v ? (JSON.parse(v) as T) : null;
}
export async function saveDoc(name: string, data: unknown) {
  if (!KV_URL || !KV_TOKEN) return writeJson(docFile(name), data);
  await kv(["SET", `yr:${name}`, JSON.stringify(data)]);
}
export async function dropDoc(name: string) {
  if (!KV_URL || !KV_TOKEN) return fs.rm(docFile(name), { force: true });
  await kv(["DEL", `yr:${name}`]);
}
