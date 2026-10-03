"use client";
// "My memories": every finished result, kept only in this browser's IndexedDB. Nothing leaves the device.
import type { CallMeta } from "./serp";
import type { Candidate, City, DishClass, MemoryInput, Scene } from "./types";

export interface SavedReveal {
  payload: unknown;
  source: "live" | "recorded";
  recordedAt?: string;
  provenance: CallMeta[];
  needCity?: boolean;
}

export interface HistoryEntry {
  id: string;
  createdAt: number;
  input: MemoryInput;
  candidate: Candidate;
  dishClass: DishClass;
  reveal: Partial<Record<Scene, SavedReveal>>;
  calls: CallMeta[];
  you?: City | null;
  home?: City | null;
}

const DB = "yaadon-ki-rasoi";
const STORE = "results";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Private windows or blocked storage just mean no history; the app keeps working.
async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  try {
    const db = await open();
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export const saveResult = (e: HistoryEntry) => run("readwrite", (s) => s.put(e));
export const getResult = (id: string) => run<HistoryEntry | undefined>("readonly", (s) => s.get(id));
export const deleteResult = (id: string) => run("readwrite", (s) => s.delete(id));
export async function listResults() {
  const all = (await run<HistoryEntry[]>("readonly", (s) => s.getAll())) ?? [];
  return all.sort((a, b) => b.createdAt - a.createdAt);
}
