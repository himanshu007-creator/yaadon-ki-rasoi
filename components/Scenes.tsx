"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CallMeta } from "@/lib/serp";
import { haversineKm } from "@/lib/geo";
import { stateById } from "@/lib/states";
import { titleCase } from "@/lib/text";
import { byLanguage, LANG_NAME, langOf, voiceFor } from "@/lib/voices";
import type { AliasMap, Candidate, City, Heartbeat, ShopsPack, StepsPack } from "@/lib/types";
import { Diya } from "./Diya";
import { IndiaSvg, type Lit } from "./IndiaSvg";
import { L, useT } from "./Lang";

export const ENGINE_NAME: Record<string, string> = {
  google: "Google Search",
  google_images: "Google Images",
  google_trends: "Google Trends",
  youtube: "YouTube Search",
  youtube_video_transcript: "YouTube Transcript",
  google_maps: "Google Maps",
  google_maps_reviews: "Maps Reviews",
};

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

/** Honest provenance on every scene: live, cached, or recorded (with the date). */
export function SourceChip({ engine, source, recordedAt }: { engine: string; source?: CallMeta["source"] | "recorded"; recordedAt?: string }) {
  const { t } = useT();
  const label = source === "replay" || source === "recorded" ? t("recordedOn", { date: fmtDate(recordedAt) }) : source === "app-cache" ? t("cache") : t("live");
  return (
    <span className="tag" title={`${ENGINE_NAME[engine] ?? engine} · ${label}`}>
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: source === "live" ? "#6fbf73" : "var(--turmeric)" }} />
      {ENGINE_NAME[engine] ?? engine} · {label}
    </span>
  );
}

export function SceneShell({ id, eyebrow, title, sub, chip, children }: { id: string; eyebrow?: string; title: string; sub?: string; chip?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${id}-h`} className="rise scroll-mt-20 space-y-4 py-8">
      <div className="space-y-2">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 id={`${id}-h`} className="text-[clamp(26px,6vw,36px)]">
          {title}
        </h2>
        {sub && <p className="dim max-w-[60ch]">{sub}</p>}
        {chip}
      </div>
      {children}
    </section>
  );
}

export function Skeleton({ h = 180, label }: { h?: number; label: string }) {
  return (
    <div className="card relative grid place-items-center overflow-hidden" style={{ height: h }} aria-busy="true">
      <div className="flex items-center gap-3 dim">
        <Diya size={36} />
        <span>{label}</span>
      </div>
    </div>
  );
}

/* ---------------- Polaroid ---------------- */

const RANGOLI =
  "radial-gradient(circle at 50% 50%, rgb(255 200 61 / .35) 0 12%, transparent 13%), repeating-conic-gradient(from 0deg, rgb(247 127 0 / .35) 0 15deg, rgb(198 42 51 / .25) 15deg 30deg)";

export function Polaroid({ c, tilt = 0, big = false }: { c: Candidate; tilt?: number; big?: boolean }) {
  const { t } = useT();
  const [broken, setBroken] = useState(false);
  return (
    <figure className="m-0 rounded-[6px] bg-[#fffaf0] p-3 pb-4 text-[var(--ink)] shadow-[0_24px_60px_-20px_rgb(0_0_0/.7)]" style={{ transform: `rotate(${tilt}deg)` }}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-[3px] bg-[#2a170c]">
        {c.photo && !broken ? (
          // Google-hosted thumbnail, shown with its source and a link back. Never re-hosted.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.photo.thumb} alt={c.name} referrerPolicy="no-referrer" loading={big ? "eager" : "lazy"} onError={() => setBroken(true)} className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="grid h-full w-full place-items-center" style={{ background: RANGOLI }} aria-hidden>
            <Diya size={64} />
          </div>
        )}
      </div>
      <figcaption className="px-1 pt-3">
        {c.nameNative && (
          <p className={`font-display ${big ? "text-[34px]" : "text-[26px]"} leading-tight`}>
            <L>{c.nameNative}</L>
          </p>
        )}
        <p className={`hand ${c.nameNative ? "text-[22px]" : big ? "text-[38px]" : "text-[30px]"} leading-tight`}>{c.name}</p>
        {c.photo && (
          <a href={c.photo.link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[12px] text-[var(--ink-dim)] underline-offset-2 hover:underline">
            {t("photoFrom")}: {c.photo.source} ↗
          </a>
        )}
      </figcaption>
    </figure>
  );
}

/* ---------------- Names map + grandmothers' voices ---------------- */

const PALETTE = ["#ff9f1c", "#ef6f7f", "#7cc47f", "#ffd166", "#a99cf5"];

function useVoice() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const play = (items: { state: string; src: string }[]) => {
    audio.current?.pause();
    const next = (i: number) => {
      if (i >= items.length) return setPlaying(null);
      const a = new Audio(items[i].src);
      audio.current = a;
      setPlaying(items[i].state);
      setFailed(false);
      a.onended = () => next(i + 1);
      a.onerror = () => (setFailed(true), next(i + 1));
      void a.play().catch(() => (setFailed(true), setPlaying(null)));
    };
    next(0);
  };
  const stop = () => {
    audio.current?.pause();
    setPlaying(null);
  };
  useEffect(() => () => audio.current?.pause(), []);
  return { play, stop, playing, failed };
}

export function NamesMap({ map }: { map: AliasMap }) {
  const { t } = useT();
  const [sel, setSel] = useState<string | null>(null);
  const voice = useVoice();
  const colorOf = (name: string) => PALETTE[Math.max(0, map.names.indexOf(name)) % PALETTE.length];
  const ranked = useMemo(() => Object.entries(map.byState).sort((a, b) => b[1].share - a[1].share), [map]);
  const langs = useMemo(() => byLanguage(map.byState), [map]);
  const counts = map.names.map((n) => ({ n, c: ranked.filter(([, v]) => v.name === n).length }));
  const lit: Lit[] = ranked.map(([id, v], i) => ({ state: id, color: colorOf(v.name), label: v.name, delay: 200 + i * 120 }));
  const srcFor = (state: string) => {
    const lang = langOf(state);
    return { lang, ...voiceFor(lang, langs.get(lang)?.dish ?? titleCase(map.byState[state]?.name ?? "")) };
  };
  const tap = (state: string) => {
    setSel(state);
    const { src } = srcFor(state);
    if (src) voice.play([{ state, src }]);
  };
  const playAll = () => voice.play([...langs.values()].flatMap((l) => { const { src } = srcFor(l.state); return src ? [{ state: l.state, src }] : []; }));
  const focus = voice.playing ?? sel ?? ranked[0]?.[0];
  const f = focus ? { st: stateById(focus), v: map.byState[focus], ...srcFor(focus) } : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="mx-auto w-full max-w-[560px]">
        <IndiaSvg lit={lit} selected={sel} playing={voice.playing} onState={tap} label={t("namesSub")} />
        <p className="muted mt-2 text-center text-[13px]">{t("tapState")}</p>
        <p className="muted mt-1 text-center text-[11px]">{t("mapNote")}</p>
      </div>
      <div className="space-y-4">
        <button className="btn btn-primary btn-block" onClick={voice.playing ? voice.stop : playAll}>
          {voice.playing ? `■ ${t("stopVoice")}` : `▶ ${t("listenAll")}`}
        </button>
        {f?.st && f.v && (
          <div aria-live="polite" className="paper space-y-2 p-5">
            <p className="m-0 text-[13px] text-[var(--ink-dim)]">
              {f.st.name} · {LANG_NAME[f.lang]}
              {voice.playing === focus ? " · 🔊" : ""}
            </p>
            <p className="font-display m-0 text-[30px] capitalize" style={{ color: "#b34700" }}>
              {f.v.name}
            </p>
            <p className="hand m-0 text-[19px] leading-[30px]">“{f.roman}”</p>
            <p className="m-0 text-[13px] text-[var(--ink-dim)]">
              {t("meaning")}: {f.en}
            </p>
            {voice.failed && <p className="m-0 text-[12px] text-[var(--kumkum)]">{t("noVoice")}</p>}
          </div>
        )}
        <ul className="m-0 list-none space-y-2 p-0">
          {counts.map(({ n, c }) => (
            <li key={n} className="flex items-center gap-3">
              <span aria-hidden className="h-4 w-4 shrink-0 rounded-full" style={{ background: colorOf(n), boxShadow: `0 0 10px ${colorOf(n)}` }} />
              <span className="font-display text-[20px] capitalize">{n}</span>
              <span className="muted ml-auto text-[14px]">{c}</span>
            </li>
          ))}
        </ul>
        <details className="card p-3">
          <summary className="min-h-[32px] cursor-pointer font-medium">{t("listAlt")}</summary>
          <ul className="m-0 mt-2 list-none space-y-1 p-0 text-[15px]">
            {ranked.map(([id, v]) => (
              <li key={id}>
                <button className="flex w-full justify-between gap-3 text-left" onClick={() => tap(id)}>
                  <span>{stateById(id)?.name ?? id}</span>
                  <span className="capitalize">
                    {v.name} <span className="muted">· {v.share}%</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </details>
        <p className="muted m-0 text-[12px]">🎙 {t("aiVoice")}</p>
      </div>
    </div>
  );
}

/* ---------------- Doori: you ↔ the maker's home ---------------- */

export function Doori({ you, home, makerLabel, gentle }: { you: City; home: City; makerLabel: string; gentle: boolean }) {
  const { t } = useT();
  const km = Math.round(haversineKm(you, home));
  const kmText = km.toLocaleString("en-IN");
  const title = km < 3 ? t("dooriSame", { maker: makerLabel }) : t(km < 40 ? "dooriNear" : "dooriTitle", { maker: makerLabel, km: kmText });
  const sub = gentle ? t("dooriGentle") : km < 40 ? t("dooriSubNear") : t("dooriSub");
  const youSpot = { ...you, kind: "you" as const, label: t("youLabel") };
  const homeSpot = { ...home, kind: "home" as const, label: t("homeOf", { maker: makerLabel }) };
  return (
    <div className="grid items-center gap-6 md:grid-cols-[1fr_minmax(0,460px)]">
      <div className="text-center md:text-left">
        <p className="font-display m-0 text-[clamp(56px,15vw,112px)] leading-none text-[var(--turmeric)]" style={{ textShadow: "0 0 50px var(--glow)" }}>
          {kmText}
          <span className="text-[0.35em] text-[var(--text-dim)]"> km</span>
        </p>
        <h2 className="mt-3 text-[clamp(26px,6vw,38px)]">{title}</h2>
        <p className="hand m-0 mt-2 text-[22px] text-[var(--text-dim)]">{sub}</p>
        <p className="muted mt-4 text-[13px]">
          📍 {you.name} → 🪔 {home.name}
        </p>
        <p className="muted mt-1 text-[11px]">{t("mapNote")}</p>
      </div>
      <IndiaSvg spots={[homeSpot, youSpot]} line={[youSpot, homeSpot]} label={title} className="mx-auto max-w-[460px]" />
    </div>
  );
}

/* ---------------- Heartbeat (Trends since 2004) ---------------- */

export function HeartbeatChart({ hb }: { hb: Heartbeat }) {
  const { t } = useT();
  const W = 640;
  const H = 180;
  const P = 8;
  const t0 = hb.points[0].t;
  const t1 = hb.points[hb.points.length - 1].t;
  const max = Math.max(...hb.points.map((p) => p.v), 1);
  const X = (tt: number) => P + ((tt - t0) / (t1 - t0 || 1)) * (W - 2 * P);
  const Y = (v: number) => H - 22 - (v / max) * (H - 44);
  const line = hb.points.map((p, i) => `${i ? "L" : "M"}${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join("");
  const area = `${line}L${X(t1)},${H - 22}L${X(t0)},${H - 22}Z`;
  const years = [...new Set(hb.points.map((p) => new Date(p.t).getUTCFullYear()))].filter((y) => y % 4 === 0);
  const festive = hb.peaks.filter((p) => [8, 9, 10].includes(new Date(p.t).getUTCMonth()));
  const peakText = hb.peaks.map((p) => new Date(p.t).toLocaleDateString("en-IN", { month: "short", year: "numeric" })).slice(-8).join(", ");
  return (
    <figure className="card m-0 p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={t("heartAlt", { term: hb.term, peaks: peakText })}>
        <defs>
          <linearGradient id="hbfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff9f1c" stopOpacity=".45" />
            <stop offset="1" stopColor="#ff9f1c" stopOpacity="0" />
          </linearGradient>
        </defs>
        {years.map((y) => {
          const x = X(Date.UTC(y, 0, 1));
          return (
            <g key={y}>
              <line x1={x} x2={x} y1={10} y2={H - 22} stroke="var(--line)" />
              <text x={x} y={H - 6} textAnchor="middle" fontSize={12} fill="var(--text-mute)">
                {y}
              </text>
            </g>
          );
        })}
        <path d={area} fill="url(#hbfill)" />
        <path d={line} fill="none" stroke="#ffb347" strokeWidth={2} strokeLinejoin="round" />
        {festive.map((p) => (
          <circle key={p.t} cx={X(p.t)} cy={Y(p.v)} r={4.5} fill="#ffd166" stroke="#120a06" strokeWidth={1.5} />
        ))}
      </svg>
      <figcaption className="muted mt-2 text-[13px]">
        <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: "#ffd166" }} aria-hidden />
        {t("heartCaption")}
      </figcaption>
    </figure>
  );
}

/* ---------------- Steps (YouTube + transcript) ---------------- */

const mmss = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function Steps({ pack, makerLabel }: { pack: StepsPack; makerLabel: string }) {
  const { t } = useT();
  const [start, setStart] = useState<number | null>(null);
  const play = (ms: number) => {
    setStart(Math.floor(ms / 1000));
    document.getElementById("yt-frame")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <div className="space-y-3">
        <div id="yt-frame" className="relative aspect-video overflow-hidden rounded-2xl bg-black">
          {start === null ? (
            <button className="group absolute inset-0 h-full w-full" onClick={() => setStart(0)} aria-label={`${t("playVideo")}: ${pack.title}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://i.ytimg.com/vi/${pack.videoId}/hqdefault.jpg`} alt="" className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100" loading="lazy" />
              <span className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[var(--saffron)] shadow-lg">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="#2b1205" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </button>
          ) : (
            <iframe
              key={start}
              className="absolute inset-0 h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${pack.videoId}?autoplay=1&start=${start}&rel=0&modestbranding=1`}
              title={pack.title}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
        <p className="text-[15px]">
          <a href={`https://www.youtube.com/watch?v=${pack.videoId}`} target="_blank" rel="noopener noreferrer" className="font-medium">
            {pack.title}
          </a>{" "}
          <span className="muted">· {pack.channel}</span>
        </p>
        {pack.ingredients.length > 0 && (
          <div className="paper p-5">
            <h3 className="mb-2 text-[22px]">{t("almari", { maker: makerLabel })}</h3>
            <ul className="hand m-0 grid list-none grid-cols-2 gap-x-4 p-0 text-[19px] leading-[34px]">
              {pack.ingredients.map((i) => (
                <li key={i.name} dir="auto">
                  {i.name}
                  {i.qty ? <span className="text-[var(--ink-dim)]"> — {i.qty}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="space-y-3">
        <p className="tag !whitespace-normal !py-1.5">{pack.steps.length ? (pack.mode === "ai-summary" ? t("stepsAi", { channel: pack.channel }) : t("stepsVerbatim", { channel: pack.channel })) : t("stepsNone")}</p>
        <ol className="m-0 list-none space-y-3 p-0">
          {pack.steps.map((s) => (
            <li key={s.n} className="card flex gap-4 p-4">
              <span className="font-display grid h-9 w-9 shrink-0 place-items-center rounded-full text-[18px]" style={{ background: "var(--marigold)", color: "#2b1205" }} aria-hidden>
                {s.n}
              </span>
              <div className="min-w-0 flex-1">
                <p className="m-0" dir="auto">
                  {pack.mode === "verbatim" ? <q>{s.text}</q> : s.text}
                </p>
                <button className="tag mt-2 min-h-[32px] cursor-pointer border-0" onClick={() => play(s.startMs)}>
                  ⏱ {t("watchAt", { t: mmss(s.startMs) })}
                </button>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/* ---------------- Shops (Maps + Reviews) ---------------- */

export function Shops({ pack }: { pack: ShopsPack }) {
  const { t } = useT();
  if (!pack.shops.length) return <p className="card p-5 dim">{t("noShops")}</p>;
  return (
    <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2 lg:grid-cols-3">
      {pack.shops.map((s) => (
        <li key={s.dataId} className="card flex flex-col overflow-hidden">
          <div className="flex gap-3 p-4">
            {s.thumb && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.thumb} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
            )}
            <div className="min-w-0">
              <h3 className="font-body text-[18px] font-semibold leading-snug">{s.title}</h3>
              <p className="muted m-0 text-[14px]">
                {s.rating ? <span className="text-[var(--turmeric)]">★ {s.rating}</span> : null}
                {s.reviews ? ` (${s.reviews.toLocaleString("en-IN")})` : ""} · {t("km", { n: s.distanceKm })}
                {s.openState ? ` · ${s.openState}` : ""}
              </p>
              {s.mentions > 0 && <p className="tag mt-1">{t("mentions", { n: s.mentions })}</p>}
            </div>
          </div>
          {s.quote && (
            <blockquote className="paper mx-4 mb-4 mt-0 px-4 py-3">
              <p className="hand m-0 text-[19px] leading-[30px]" dir="auto">
                “{s.quote.text}”
              </p>
              <footer className="mt-1 text-[12px] text-[var(--ink-dim)]">
                — <a href={s.quote.link} target="_blank" rel="noopener noreferrer">{t("reviewer")}</a>
                {s.quote.date ? ` · ${s.quote.date}` : ""}
              </footer>
            </blockquote>
          )}
          <div className="mt-auto flex gap-2 border-t border-[var(--line)] p-3">
            {s.phone && (
              <a className="btn btn-ghost btn-sm flex-1" href={`tel:${s.phone.replace(/\s/g, "")}`}>
                {t("call")}
              </a>
            )}
            <a className="btn btn-ghost btn-sm flex-1" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${s.gps.lat},${s.gps.lng}`}>
              {t("directions")} ↗
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}
