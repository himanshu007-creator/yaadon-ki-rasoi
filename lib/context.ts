import { AsyncLocalStorage } from "node:async_hooks";

// Which SerpApi key a request may use. Scripts (verify/record) run outside any request and use the env key.
interface Ctx {
  key?: string;
  byo: boolean; // the visitor's own key: their credits, so our daily cap doesn't apply
}
const als = new AsyncLocalStorage<Ctx>();

/** Public deploys (NEXT_PUBLIC_VERCEL_DEPLOY=true) never spend the server's key; visitors bring their own. */
export const deployMode = () => process.env.NEXT_PUBLIC_VERCEL_DEPLOY === "true";
export const isSerpKey = (k?: string | null): k is string => !!k && /^[a-f0-9]{64}$/i.test(k.trim());

export function contextFor(req: Request): Ctx {
  const own = req.headers.get("x-serpapi-key")?.trim();
  if (isSerpKey(own)) return { key: own, byo: true };
  return { key: deployMode() ? undefined : process.env.SERPAPI_API_KEY || undefined, byo: false };
}

export const runWith = <T>(ctx: Ctx, fn: () => T) => als.run(ctx, fn);

export function currentKey() {
  const ctx = als.getStore();
  return ctx ? ctx.key : process.env.SERPAPI_API_KEY || undefined;
}
export const isByo = () => als.getStore()?.byo ?? false;
