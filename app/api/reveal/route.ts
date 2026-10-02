import { z } from "zod";
import { reveal } from "@/lib/agent/pipeline";
import { body, InputSchema } from "@/lib/http";
import { sseResponse } from "@/lib/sse";

export const runtime = "nodejs";
export const maxDuration = 60;

const CandidateSchema = z.object({
  id: z.string().max(20),
  name: z.string().min(1).max(60),
  nameNative: z.string().max(60).optional(),
  aliases: z.array(z.string().max(60)).max(10),
  supportDocIds: z.array(z.string().max(30)).max(40),
  matched: z.array(z.string().max(40)).max(12),
  domains: z.array(z.string().max(80)).max(30),
  score: z.number(),
  photo: z.object({ thumb: z.string().url().max(2000), source: z.string().max(120), link: z.string().max(2000) }).optional(),
});

const Schema = z.object({
  input: InputSchema,
  candidate: CandidateSchema,
  dishClass: z.enum(["sweet", "snack", "savory", "drink", "remedy", "offering", "unknown"]).default("unknown"),
  recorded: z.string().max(40).optional(),
  only: z.enum(["aliases", "heartbeat", "steps", "shops"]).optional(),
});

export async function POST(req: Request) {
  const b = await body(req, Schema);
  if (!b.ok) return b.res;
  const { input, candidate, dishClass, recorded, only } = b.data;
  return sseResponse(req, (emit) => reveal(input, candidate, emit, { dishClass, recordedSlug: recorded, only }));
}
