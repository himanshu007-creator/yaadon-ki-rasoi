"use client";
import { forwardRef, useEffect, useState } from "react";
import type { StepsPack } from "@/lib/types";
import { Diya } from "./Diya";
import { IndiaSvg, type Lit } from "./IndiaSvg";
import { L, useT } from "./Lang";

export interface CardData {
  maker: string;
  dish: string;
  native?: string;
  gentle: boolean;
  names: { state: string; name: string }[]; // state ids
  km?: number;
  hb?: { festive: number; years: number };
  from?: string;
  to?: string;
  steps?: StepsPack | null;
}

const PALETTE = ["#ff9f1c", "#ef6f7f", "#7cc47f", "#ffd166", "#a99cf5"];

/** 540×675 (exported at 2× = 1080×1350, Instagram portrait). Generated art only — no scraped photos. */
export const ShareCard = forwardRef<HTMLDivElement, { d: CardData }>(function ShareCard({ d }, ref) {
  const { t } = useT();
  const [host, setHost] = useState("");
  useEffect(() => setHost(location.host), []);
  const tally = new Map<string, number>();
  for (const n of d.names) tally.set(n.name.toLowerCase(), (tally.get(n.name.toLowerCase()) ?? 0) + 1);
  const distinct = [...tally.keys()].sort((a, b) => tally.get(b)! - tally.get(a)!);
  const color = (n: string) => PALETTE[distinct.indexOf(n.toLowerCase()) % PALETTE.length];
  const lit: Lit[] = d.names.map((n) => ({ state: n.state, color: color(n.name), label: n.name, delay: 0 }));
  return (
    <div ref={ref} className="share-card flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Diya size={30} />
          <span className="font-display text-[19px]">Yaadon Ki Rasoi</span>
        </div>
        <span className="text-[13px] text-[var(--text-mute)]">Diwali 2026</span>
      </div>

      <div className="mt-3 text-center">
        <p className="eyebrow m-0">{t("found")}</p>
        <p className="hand m-0 mt-1 text-[24px] text-[var(--text-dim)]">{t(d.gentle ? "cardInMemory" : "cardMaker", { maker: d.maker })}</p>
        <p className="font-display m-0 text-[46px] leading-[1.05] text-[var(--turmeric)]" style={{ textShadow: "0 0 30px rgb(255 170 60 / .45)" }}>
          {d.dish}
        </p>
        {d.native && (
          <p className="font-display m-0 text-[26px] text-[var(--text-dim)]">
            <L>{d.native}</L>
          </p>
        )}
      </div>

      {d.names.length > 0 ? (
        <div className="mt-2 grid grid-cols-[215px_1fr] items-center gap-4">
          <IndiaSvg lit={lit} label="" className="no-anim !border-0 !bg-transparent" />
          <div>
            <p className="font-display m-0 text-[22px]">{t("cardNames", { n: distinct.length })}</p>
            <ul className="m-0 mt-2 list-none space-y-1.5 p-0">
              {distinct.slice(0, 5).map((n) => (
                <li key={n} className="flex items-center gap-2 text-[17px] capitalize">
                  <span className="h-3 w-3 rounded-full" style={{ background: color(n) }} />
                  {n}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="mt-10 flex justify-center">
          <Diya size={150} />
        </div>
      )}

      <div className="mt-auto space-y-2.5">
        {d.hb && d.hb.years > 0 && (
          <p className="hand m-0 text-center text-[17px] leading-snug text-[var(--text-dim)]">{t("cardPulse", { f: d.hb.festive, y: d.hb.years })}</p>
        )}
        {d.km !== undefined && d.from && d.to && (
          <div className="rounded-2xl px-4 py-3 text-center" style={{ background: "rgb(255 200 61 / .1)", border: "1px solid rgb(255 200 61 / .3)" }}>
            <p className="m-0 text-[15px] text-[var(--text-dim)]">
              📍 {d.from} → 🪔 {d.to}
            </p>
            <p className="font-display m-0 text-[24px] text-[var(--turmeric)]">{t("cardDistance", { km: d.km.toLocaleString("en-IN") })}</p>
            <p className="hand m-0 text-[17px] text-[var(--text-dim)]">{d.gentle ? t("dooriGentle") : t("dooriSub")}</p>
          </div>
        )}
        <p className="m-0 text-center text-[14px] text-[var(--text-mute)]">
          {t("cardFooter")} <span className="text-[var(--marigold)]">{host}</span>
        </p>
      </div>
    </div>
  );
});

const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

/** A4-width sheet for the PDF's second page: ingredients, timestamped steps, names, family notes. */
export const RecipeSheet = forwardRef<HTMLDivElement, { d: CardData }>(function RecipeSheet({ d }, ref) {
  const { t } = useT();
  const s = d.steps;
  return (
    <div ref={ref} className="recipe-sheet paper">
      <p className="m-0 text-[13px] text-[var(--ink-dim)]">Yaadon Ki Rasoi · {t("recipeSheet")}</p>
      <h2 className="mt-1 text-[38px]">
        {d.maker} — {d.dish} {d.native && <L>{d.native}</L>}
      </h2>
      {s && s.ingredients.length > 0 && (
        <>
          <h3 className="mt-5 text-[22px]">{t("ingredients")}</h3>
          <ul className="hand m-0 grid grid-cols-2 gap-x-6 p-0 pl-5 text-[19px] leading-[32px]">
            {s.ingredients.map((i) => (
              <li key={i.name}>
                {i.name}
                {i.qty ? ` — ${i.qty}` : ""}
              </li>
            ))}
          </ul>
        </>
      )}
      {s && s.steps.length > 0 && (
        <>
          <h3 className="mt-5 text-[22px]">{t("stepsTitle")}</h3>
          <ol className="m-0 list-decimal space-y-2 p-0 pl-6 text-[16px]">
            {s.steps.map((x) => (
              <li key={x.n}>
                {x.text} <span className="text-[13px] text-[var(--ink-dim)]">⏱ {mmss(x.startMs)}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[13px] text-[var(--ink-dim)]">
            {s.mode === "ai-summary" ? t("stepsAi", { channel: s.channel }) : t("stepsVerbatim", { channel: s.channel })} youtube.com/watch?v={s.videoId}
          </p>
        </>
      )}
      {d.names.length > 0 && (
        <>
          <h3 className="mt-5 text-[22px]">{t("namesAcross")}</h3>
          <p className="m-0 text-[15px] capitalize">{[...new Set(d.names.map((n) => n.name))].join(" · ")}</p>
        </>
      )}
    </div>
  );
});
