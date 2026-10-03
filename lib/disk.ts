import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// Vercel functions can only write to /tmp (per instance, best-effort) — fine for these caches.
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
