// ponytail: one document per family (Upstash KV or a JSON file) + an in-process lock; races across instances are possible.
import crypto from "node:crypto";
import path from "node:path";
import { dropDoc, loadDoc, readJson, saveDoc, withLock } from "./disk";
import type { Candidate, Festival, Maker, StepsPack } from "./types";

export interface Contribution {
  id: string;
  kind: "confirm" | "note";
  name: string;
  relation?: string;
  body?: string;
  hidden: boolean;
  createdAt: string;
  ipHash: string;
}

export interface Family {
  slug: string;
  ownerKeyHash: string;
  ownerName: string;
  maker?: Maker;
  remembered: boolean;
  festival: Festival;
  dish: { name: string; nameNative?: string; aliases: string[]; photo?: Candidate["photo"] };
  names: { state: string; name: string }[];
  steps?: StepsPack | null;
  voice?: { src: string; name: string; relation: string };
  createdAt: string;
  expiresAt: string;
  teenSeetiAt?: string;
  contributions: Contribution[];
}

export const LIMITS = { perFamily: 30, perIpHour: 5, body: 280, name: 40 };
const doc = (slug: string) => `families/${slug.replace(/[^A-Z0-9-]/g, "")}`;
const DEMO = "DEMO-NANI";
const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
export const hashIp = (ip: string) => sha(`yaadon:${ip}`).slice(0, 16);

const B32 = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L: easy to read aloud
function slug10() {
  const bytes = crypto.randomBytes(10);
  return [...bytes].map((b) => B32[b % B32.length]).join("");
}

export async function createFamily(input: Omit<Family, "slug" | "ownerKeyHash" | "createdAt" | "expiresAt" | "contributions">) {
  const slug = slug10();
  const ownerKey = crypto.randomBytes(16).toString("base64url");
  const now = Date.now();
  const fam: Family = {
    ...input,
    slug,
    ownerKeyHash: sha(ownerKey),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 120 * 86400_000).toISOString(),
    contributions: [],
  };
  await saveDoc(doc(slug), fam);
  return { slug, ownerKey };
}

export async function getFamily(slug: string): Promise<Family | null> {
  let f = await loadDoc<Family>(doc(slug));
  if (!f && slug === DEMO) {
    f = await readJson<Family>(path.join(process.cwd(), "fixtures", "demo-family.json"));
    if (f) {
      f.expiresAt = new Date(Date.now() + 120 * 86400_000).toISOString();
      await saveDoc(doc(slug), f);
    }
  }
  if (!f) return null;
  if (Date.parse(f.expiresAt) < Date.now()) {
    await dropDoc(doc(slug));
    return null;
  }
  return f;
}

export const isOwner = (f: Family, key?: string | null) =>
  !!key && crypto.timingSafeEqual(Buffer.from(sha(key)), Buffer.from(f.ownerKeyHash));

export const confirmCount = (f: Family) => f.contributions.filter((c) => c.kind === "confirm" && !c.hidden).length;

/** What anyone with the link may see: no key hashes, no IP hashes, no hidden entries. */
export function publicView(f: Family, owner = false) {
  const { ownerKeyHash, contributions, ...rest } = f;
  void ownerKeyHash;
  return {
    ...rest,
    count: confirmCount(f),
    contributions: contributions.filter((c) => owner || !c.hidden).map(({ ipHash, ...c }) => (void ipHash, c)),
  };
}
export type PublicFamily = ReturnType<typeof publicView>;

export class LimitError extends Error {}

export function addContribution(slug: string, c: Pick<Contribution, "kind" | "name" | "relation" | "body">, ip: string) {
  return withLock(doc(slug), async () => {
    const f = await getFamily(slug);
    if (!f) return null;
    const ipHash = hashIp(ip);
    if (f.contributions.length >= LIMITS.perFamily) throw new LimitError("family-full");
    const hourAgo = Date.now() - 3600_000;
    if (f.contributions.filter((x) => x.ipHash === ipHash && Date.parse(x.createdAt) > hourAgo).length >= LIMITS.perIpHour)
      throw new LimitError("slow-down");
    const before = confirmCount(f);
    const entry: Contribution = { id: crypto.randomBytes(6).toString("base64url"), ...c, hidden: false, createdAt: new Date().toISOString(), ipHash };
    f.contributions.push(entry);
    const count = confirmCount(f);
    const teenSeeti = !f.teenSeetiAt && before < 3 && count >= 3;
    if (teenSeeti) f.teenSeetiAt = entry.createdAt;
    await saveDoc(doc(slug), f);
    return { id: entry.id, count, teenSeeti };
  });
}

export function setHidden(slug: string, id: string, hidden: boolean) {
  return withLock(doc(slug), async () => {
    const f = await getFamily(slug);
    const c = f?.contributions.find((x) => x.id === id);
    if (!f || !c) return false;
    c.hidden = hidden;
    await saveDoc(doc(slug), f);
    return true;
  });
}

export const deleteFamily = (slug: string) => dropDoc(doc(slug));

// ponytail: in-memory sliding window; resets on restart. Upstash ratelimit when multi-instance.
const hits = new Map<string, number[]>();
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    hits.set(key, arr);
    return false;
  }
  arr.push(now);
  hits.set(key, arr);
  return true;
}

export const clientIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
