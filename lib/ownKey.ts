"use client";
// A visitor's own SerpApi key lives only in their browser and rides along on each search request.
const KEY = "yr-serpapi-key";

export const deployMode = process.env.NEXT_PUBLIC_VERCEL_DEPLOY === "true";

export function getOwnKey() {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
export function setOwnKey(k: string) {
  try {
    if (k) localStorage.setItem(KEY, k);
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("yr-key"));
  } catch {}
}
export const ownKeyHeaders = (): Record<string, string> => {
  const k = getOwnKey();
  return k ? { "x-serpapi-key": k } : {};
};
