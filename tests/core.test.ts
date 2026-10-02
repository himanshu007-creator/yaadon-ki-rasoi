import { describe, expect, it, vi } from "vitest";

const getJson = vi.fn(async () => {
  await new Promise((r) => setTimeout(r, 30));
  return { organic_results: [] };
});
vi.mock("serpapi", () => ({ getJson, getAccount: vi.fn(async () => ({ total_searches_left: 0 })) }));

process.env.SERPAPI_API_KEY = "test-key";
process.env.DEMO_MODE = "live";
process.env.DAILY_CREDIT_CAP = "100000";

const { cacheKey, serp, redact } = await import("@/lib/serp");
const { validate, rank } = await import("@/lib/agent/candidates");
const { heritageScore, pickQuote, groundSteps } = await import("@/lib/agent/reveal");
const { findState } = await import("@/lib/states");
const { addContribution, createFamily, deleteFamily } = await import("@/lib/store");
const { classify } = await import("@/lib/budget");
import type { Doc, ParsedMemory } from "@/lib/types";

const doc = (id: string, domain: string, title: string, snippet: string): Doc => ({ id, domain, url: `https://${domain}/${id}`, title, snippet, kind: "organic" });

describe("serp door", () => {
  it("cache key ignores param order, case and the api key", () => {
    expect(cacheKey("google", { q: "Anarsa", gl: "in" })).toBe(cacheKey("google", { gl: "IN", q: "anarsa ", api_key: "x" }));
    expect(cacheKey("google", { q: "anarsa" })).not.toBe(cacheKey("youtube", { q: "anarsa" }));
  });

  it("coalesces identical concurrent misses into one call", async () => {
    getJson.mockClear();
    const params = { q: `singleflight-${Date.now()}` };
    const [a, b] = await Promise.all([serp("google", params, "retrieve"), serp("google", params, "retrieve")]);
    expect(getJson).toHaveBeenCalledTimes(1);
    expect(a.data).toBe(b.data);
    expect(a.meta.source).toBe("live");
  });

  it("redacts the key from recorded fixtures", () => {
    const out = redact({ search_metadata: { json_endpoint: "x" }, link: "https://serpapi.com/search?api_key=test-key&q=a" });
    expect(JSON.stringify(out)).not.toContain("test-key");
    expect(out.search_metadata.json_endpoint).toBeUndefined();
  });

  it("tells out-of-credits from throttling via the account API", async () => {
    expect((await classify('{"error":"Your account has run out of searches."}')).kind).toBe("out-of-credits");
  });
});

describe("provenance + rank", () => {
  const docs = [
    doc("d1", "hebbarskitchen.com", "Anarsa recipe | Diwali special", "rice flour, jaggery and sesame seeds, deep fried. Also known as Adhirasam"),
    doc("d2", "nishamadhulika.com", "Anarse", "Anarsa made with jaggery and poppy seeds"),
    doc("d3", "example.com", "Gujiya recipe", "maida pastry stuffed with khoya"),
  ];
  const parsed: ParsedMemory = { dishClass: "sweet", descriptors: ["jaggery", "sesame", "deep fried"], descriptorsNative: [], regionHints: [], queries: [] };

  it("drops a planted alias and an invented dish", () => {
    const out = validate(
      [
        { name: "Anarsa", aliases: ["Adhirasam", "Totally Fake Name"], supportDocIds: ["d1"], matchedDescriptors: [] },
        { name: "Imaginary Laddoo", aliases: [], supportDocIds: ["d1"], matchedDescriptors: [] },
      ],
      docs,
      parsed.descriptors,
    );
    expect(out.map((c) => c.name)).toEqual(["Anarsa"]);
    expect(out[0].aliases).toEqual(["Adhirasam"]);
    expect(out[0].domains).toContain("nishamadhulika.com");
  });

  it("ranks the better-matched, better-supported dish first", () => {
    const cands = validate(
      [
        { name: "Gujiya", aliases: [], supportDocIds: [], matchedDescriptors: [] },
        { name: "Anarsa", aliases: [], supportDocIds: [], matchedDescriptors: [] },
      ],
      docs,
      parsed.descriptors,
    );
    expect(rank(cands, parsed, docs)[0].name).toBe("Anarsa");
  });
});

describe("reveal helpers", () => {
  it("normalises Trends state codes and names", () => {
    expect(findState("IN-OR")?.id).toBe("OD");
    expect(findState("IN-OD")?.id).toBe("OD");
    expect(findState(undefined, "Orissa")?.id).toBe("OD");
    expect(findState("IN-TS")?.id).toBe("TG");
  });

  it("prefers well-reviewed heritage shops", () => {
    const old = heritageScore({ title: "Chitale Bandhu Mithaiwale since 1950", reviews: 20000, rating: 4.6, openState: "Open" });
    const fresh = heritageScore({ title: "Cake Point", reviews: 12, rating: 3.9 });
    expect(old).toBeGreaterThan(fresh);
  });

  it("only quotes verbatim nostalgic sentences that name the dish", () => {
    const reviews = [
      { snippet: "Great parking. The anarsa here tastes exactly like my nani used to make every Diwali. Staff is rude.", likes: 4, link: "L1" },
      { snippet: "Anarsa was okay.", likes: 50, link: "L2" },
    ];
    const q = pickQuote(reviews, ["Anarsa"]);
    expect(q?.text).toBe("The anarsa here tastes exactly like my nani used to make every Diwali.");
    expect(q?.link).toBe("L1");
    expect(pickQuote([{ snippet: "Nice shop, good service and clean." }], ["Anarsa"])).toBeUndefined();
  });

  it("rejects steps whose timestamps are not in the transcript", () => {
    const chunks = [{ startMs: 0 }, { startMs: 20_000 }, { startMs: 40_000 }];
    expect(groundSteps([{ text: "a", startMs: 0 }, { text: "b", startMs: 21_000 }, { text: "c", startMs: 40_000 }], chunks)).toHaveLength(3);
    expect(groundSteps([{ text: "a", startMs: 0 }, { text: "b", startMs: 99_000 }, { text: "c", startMs: 40_000 }], chunks)).toBeNull();
  });
});

describe("family", () => {
  it("fires Teen seeti exactly once", async () => {
    const { slug } = await createFamily({ ownerName: "T", remembered: false, festival: "diwali", dish: { name: "Anarsa", aliases: [] }, names: [] });
    const r = [];
    for (const [i, name] of ["A", "B", "C", "D"].entries()) r.push(await addContribution(slug, { kind: "confirm", name }, `10.0.0.${i}`));
    expect(r.map((x) => x?.teenSeeti)).toEqual([false, false, true, false]);
    await deleteFamily(slug);
  });
});

describe("map projection", async () => {
  const { toSvg, fromSvg } = await import("@/lib/geo");
  it("lands cities inside their state shapes and round-trips", () => {
    const delhi = toSvg({ lat: 28.61, lng: 77.21 }); // Delhi path bbox x 181–191.6, y 204.7–216.1
    expect(delhi.x).toBeGreaterThan(181);
    expect(delhi.x).toBeLessThan(191.6);
    expect(delhi.y).toBeGreaterThan(204.7);
    expect(delhi.y).toBeLessThan(216.1);
    const back = fromSvg(delhi.x, delhi.y);
    expect(back.lat).toBeCloseTo(28.61, 5);
    expect(back.lng).toBeCloseTo(77.21, 5);
  });
});

describe("whose SerpApi key a request uses", async () => {
  const { contextFor } = await import("@/lib/context");
  const req = (key?: string) => new Request("http://x", { headers: key ? { "x-serpapi-key": key } : {} });
  const own = "a".repeat(64);
  it("uses the visitor's key when valid, else the server key — except on public deploys", () => {
    expect(contextFor(req(own))).toEqual({ key: own, byo: true });
    expect(contextFor(req("not-a-key")).byo).toBe(false);
    expect(contextFor(req()).key).toBe("test-key");
    process.env.NEXT_PUBLIC_VERCEL_DEPLOY = "true";
    expect(contextFor(req()).key).toBeUndefined();
    expect(contextFor(req(own)).key).toBe(own);
    delete process.env.NEXT_PUBLIC_VERCEL_DEPLOY;
  });
});
