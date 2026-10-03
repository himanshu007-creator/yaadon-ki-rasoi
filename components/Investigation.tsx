"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { CopyKey } from "@/lib/copy";
import type { CallMeta } from "@/lib/serp";
import { haptic, tink, whistle } from "@/lib/sound";
import { haversineKm } from "@/lib/geo";
import { stateById } from "@/lib/states";
import { saveResult } from "@/lib/history";
import { postStream, startSearch } from "@/lib/stream";
import { QUESTIONS, type AliasMap, type Candidate, type City, type DishClass, type Heartbeat, type MemoryInput, type Scene, type ShopsPack, type StepsPack } from "@/lib/types";
import { Diya } from "./Diya";
import { Drawer } from "./Drawer";
import { Header, useT } from "./Lang";
import { PlacePicker } from "./PlacePicker";
import { Doori, HeartbeatChart, NamesMap, Polaroid, SceneShell, Shops, Skeleton, SourceChip, Steps } from "./Scenes";
import type { CardData } from "./ShareCard";
import { ShareSheet } from "./ShareSheet";

type Stage = { status: "start" | "ok" | "skip" | "fail"; meta?: { words?: string[]; pages?: number; domains?: string[]; count?: number; by?: string[] } };
type RevealState = { payload: unknown; source: "live" | "recorded"; recordedAt?: string; provenance: CallMeta[]; needCity?: boolean };
type Recorded = { reason: string; recordedAt: string; seed: string };

interface State {
  stages: Record<string, Stage>;
  calls: CallMeta[];
  pool: Candidate[]; // every candidate the search found, shown three at a time
  shown: number;
  dishClass: DishClass;
  recordedSlug?: string;
  recorded: Recorded | null;
  need: { questionId: string; options: string[] } | null;
  asked: boolean;
  rejected: string[];
  noMatch: boolean;
  reveal: Partial<Record<Scene, RevealState>>;
  revealDone: boolean;
  error: string | null;
}

const initial: State = { stages: {}, calls: [], pool: [], shown: 0, dishClass: "unknown", recorded: null, need: null, asked: false, rejected: [], noMatch: false, reveal: {}, revealDone: false, error: null };

type Action = { event: string; data?: any };

function reducer(s: State, { event, data }: Action): State {
  switch (event) {
    case "stage":
      return { ...s, stages: { ...s.stages, [data.id]: { status: data.status, meta: data.meta ?? s.stages[data.id]?.meta } } };
    case "call":
      return { ...s, calls: [...s.calls, data] };
    case "recorded":
      return { ...s, recorded: data };
    case "candidates":
      return { ...s, pool: data.items, shown: 0, dishClass: data.dishClass, recordedSlug: data.recorded?.slug, need: null, noMatch: false };
    case "no_match":
      return { ...s, noMatch: true, need: null, pool: [] };
    case "reveal":
      return { ...s, reveal: { ...s.reveal, [data.scene]: data } };
    case "done":
      return { ...s, revealDone: true };
    case "error":
      return { ...s, error: data.code ?? "INTERNAL" };
    // Client-side steps: next three cards, the one refine question, a fresh search.
    case "rejected": {
      const rejected = [...s.rejected, ...data.names];
      if (s.shown + 3 < s.pool.length) return { ...s, rejected, shown: s.shown + 3 };
      if (s.asked || s.recordedSlug) return { ...s, rejected, noMatch: true, pool: [] };
      const questionId = Object.keys(QUESTIONS)[0];
      return { ...s, rejected, asked: true, pool: [], need: { questionId, options: QUESTIONS[questionId] } };
    }
    case "searching":
      return { ...s, stages: {}, need: null, noMatch: false, pool: [] };
    default:
      return s;
  }
}

export interface Flagship {
  name: string;
  text: string;
}

export { initial as emptyState, type State };

export function Investigation({ input, flagships }: { input: MemoryInput; flagships: Flagship[] }) {
  const [s, dispatch] = useReducer(reducer, initial);
  const { t } = useT();
  const [aha, setAha] = useState<null | "ring" | "still" | "found" | "done">(null);
  const [picked, setPicked] = useState<Candidate | null>(null);
  const [you, setYou] = useState<City | null>(input.city ?? null);
  const [home, setHome] = useState<City | null>(input.home ?? null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  // Every finished result goes to "My memories" (IndexedDB, this browser only); later changes update the same entry.
  useEffect(() => {
    if (!picked || !s.revealDone) return;
    const id = savedId ?? `${Date.now()}-${picked.id}`;
    if (!savedId) setSavedId(id);
    void saveResult({ id, createdAt: Date.now(), input, candidate: picked, dishClass: s.dishClass, reveal: s.reveal, calls: s.calls, you, home });
  }, [picked, s.revealDone, s.reveal, you, home]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = useCallback((url: string, body: unknown) => {
    const ac = new AbortController();
    abort.current = ac;
    postStream(url, body, (event, data) => dispatch({ event, data }), ac.signal).catch((e) => {
      if (!ac.signal.aborted) dispatch({ event: "error", data: { code: navigator.onLine ? "INTERNAL" : "OFFLINE", message: String(e) } });
    });
  }, []);

  useEffect(() => {
    run("/api/investigate", { input });
    return () => abort.current?.abort();
  }, [input, run]);

  const reveal = (c: Candidate, extra: object = {}) =>
    run("/api/reveal", { input, candidate: c, dishClass: s.dishClass, recorded: s.recordedSlug, ...extra });

  // The aha beat: ring of light → 1 s stillness → "Mil gaya." alone for 1.5 s → reveal.
  const onYes = (c: Candidate) => {
    whistle(1);
    haptic(15);
    setPicked(c);
    setAha("ring");
    reveal(c);
    setTimeout(() => setAha("still"), 1000);
    setTimeout(() => setAha("found"), 2000);
    setTimeout(() => setAha("done"), 3500);
  };

  const refine = (answer: string | null) => {
    dispatch({ event: "searching" });
    run("/api/investigate", { input, refine: answer, exclude: s.rejected });
  };

  const cards = s.pool.slice(s.shown, s.shown + 3);
  let body: React.ReactNode;
  if (s.error) body = <Oops code={s.error} />;
  else if (aha && aha !== "done") body = <Aha phase={aha} c={picked!} />;
  else if (picked)
    body = (
      <>
        <Reveal s={s} c={picked} input={input} you={you} setYou={setYou} home={home} setHome={setHome} onCity={(city) => reveal(picked, { input: { ...input, city }, only: "shops" })} />
        {savedId && (
          <p role="status" className="fixed bottom-[max(16px,env(safe-area-inset-bottom))] left-4 z-30 m-0 rounded-full px-4 py-2 text-[14px]" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
            📖 <Link href="/history">{t("savedHistory")}</Link>
          </p>
        )}
      </>
    );
  else if (s.need) body = <Refine need={s.need} onAnswer={refine} />;
  else if (s.noMatch) body = <NoMatch flagships={flagships} />;
  else if (cards.length) body = <Confirm cards={cards} onYes={onYes} onRejectAll={() => dispatch({ event: "rejected", data: { names: cards.map((c) => c.name) } })} />;
  else body = <Theatre s={s} input={input} />;

  const hideChrome = aha === "still" || aha === "found";
  return (
    <>
      {!hideChrome && <Header />}
      <main id="main" className="wrap pb-28 pt-4 sm:pt-8">
        {s.recorded && !hideChrome && <RecordedBanner r={s.recorded} />}
        {body}
      </main>
      {!hideChrome && <Drawer calls={s.calls} />}
      <span className="sr-only" aria-live="assertive">
        {aha === "found" ? `${t("found")} ${picked?.name}` : ""}
      </span>
    </>
  );
}

function RecordedBanner({ r }: { r: Recorded }) {
  const { t } = useT();
  const date = new Date(r.recordedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const key = `recorded_${r.reason}` as CopyKey;
  return (
    <div role="status" className="rise mb-4 flex gap-3 rounded-2xl p-4 text-[15px]" style={{ background: "rgb(255 200 61 / .1)", border: "1px solid rgb(255 200 61 / .3)" }}>
      <span aria-hidden>📼</span>
      <div>
        <p className="m-0 font-semibold text-[var(--turmeric)]">{t("recordedTitle")}</p>
        <p className="m-0 dim">{t(key, { date })}</p>
        <p className="hand m-0 mt-1 text-[17px] muted">
          {t("recordedSeed")}: “{r.seed}”
        </p>
      </div>
    </div>
  );
}

/* ---------------- Theatre: the wait is the show ---------------- */

const THEATRE: { id: string; label: (st: Stage | undefined, t: ReturnType<typeof useT>["t"]) => string }[] = [
  { id: "parse", label: (_, t) => t("st_parse") },
  { id: "retrieve", label: (st, t) => (st?.status === "ok" ? t("st_retrieveDone", { n: st.meta?.pages ?? 0 }) : t("st_retrieve")) },
  { id: "extract", label: (st, t) => (st?.status === "ok" ? t("st_extractDone", { n: st.meta?.count ?? 0 }) : t("st_extract")) },
  { id: "photos", label: (_, t) => t("st_photos") },
];

function Theatre({ s, input }: { s: State; input: Pick<MemoryInput, "maker" | "remembered"> }) {
  const { t, maker } = useT();
  const words = s.stages.parse?.meta?.words ?? [];
  const domains = s.stages.retrieve?.meta?.domains ?? [];
  const current = [...THEATRE].reverse().find((x) => s.stages[x.id]);
  const lit = THEATRE.filter((x) => s.stages[x.id]?.status === "ok").length;
  const prevLit = useRef(0);
  useEffect(() => {
    if (lit > prevLit.current) tink();
    prevLit.current = lit;
  }, [lit]);

  return (
    <section className="narrow mx-auto flex min-h-[70dvh] flex-col items-center justify-center gap-8 py-6 text-center">
      <div className="relative">
        <div className="halo absolute inset-[-40px] rounded-full" style={{ background: "radial-gradient(circle, var(--glow), transparent 65%)" }} aria-hidden />
        <Diya size={110} />
      </div>
      <h1 className="text-[clamp(26px,6.5vw,38px)]">{input.remembered ? t("theatreGentle") : t("theatre", { maker: maker(input.maker) })}</h1>

      {s.stages.parse?.meta?.by?.length ? (
        <p className="tag rise !px-3 !py-1.5 !text-[14px]">🧠 {t("aiUsed")}</p>
      ) : null}
      {words.length > 0 && (
        <div className="rise flex flex-wrap justify-center gap-2" aria-label={t("words")}>
          {words.map((w) => (
            <span key={w} className="hand rounded-full px-3 py-1 text-[18px]" style={{ background: "var(--paper)", color: "var(--ink)" }} dir="auto">
              {w}
            </span>
          ))}
        </div>
      )}

      <ol className="m-0 w-full max-w-[420px] list-none space-y-3 p-0 text-left">
        {THEATRE.map((x) => {
          const st = s.stages[x.id];
          const done = st?.status === "ok";
          return (
            <li key={x.id} className="flex items-center gap-3 transition-opacity duration-300" style={{ opacity: st ? 1 : 0.35 }}>
              <Diya size={34} lit={done} className={done ? "pop" : undefined} />
              <span className={done ? "" : "dim"}>{x.label(st, t)}</span>
              {st && !done && <span className="ml-auto inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--marigold)]" aria-hidden />}
            </li>
          );
        })}
      </ol>

      {domains.length > 0 && (
        <div className="w-full overflow-hidden" aria-hidden>
          <p className="muted mb-2 text-[13px]">{t("reading")}</p>
          <div className="flex w-max gap-6 whitespace-nowrap text-[15px] text-[var(--text-dim)]" style={{ animation: "ticker 26s linear infinite" }}>
            {[...domains, ...domains].map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {current ? current.label(s.stages[current.id], t) : ""}
      </p>
    </section>
  );
}

/* ---------------- Confirm: three polaroids ---------------- */

function Confirm({ cards, onYes, onRejectAll }: { cards: Candidate[]; onYes: (c: Candidate) => void; onRejectAll: () => void }) {
  const { t } = useT();
  const [i, setI] = useState(0);
  const [dx, setDx] = useState(0);
  const [fly, setFly] = useState<0 | 1 | -1>(0);
  const start = useRef<number | null>(null);
  const c = cards[i];

  useEffect(() => {
    setI(0);
    setDx(0);
    setFly(0);
  }, [cards]);

  const decide = (yes: boolean) => {
    if (fly || !c) return;
    haptic(10);
    setFly(yes ? 1 : -1);
    setTimeout(() => {
      if (yes) return onYes(c);
      setFly(0);
      setDx(0);
      if (i + 1 < cards.length) setI(i + 1);
      else onRejectAll();
    }, 260);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,select")) return;
      if (e.key === "ArrowRight") decide(true);
      if (e.key === "ArrowLeft") decide(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!c) return null;
  const x = fly ? fly * 600 : dx;
  const why = [c.matched.length ? t("why", { m: c.matched.slice(0, 3).join(", ") }) : "", t("seenOn", { n: c.domains.length })].filter(Boolean).join(" · ");

  return (
    <section aria-labelledby="confirm-h" className="narrow mx-auto space-y-4 pt-1 text-center">
      <div>
        <h1 id="confirm-h" className="text-[clamp(30px,8vw,44px)]">
          {t("confirmTitle")}
        </h1>
        <p className="muted text-[15px]">{t("confirmHelp")}</p>
      </div>

      <div className="relative mx-auto w-[min(78vw,300px)] select-none">
        {cards.slice(i + 1, i + 3).reverse().map((n, k, arr) => (
          <div key={n.id} className="absolute inset-0 transition-transform duration-300" style={{ transform: `scale(${0.92 + 0.04 * k}) translateY(${(arr.length - k) * 14}px)`, opacity: 0.6 }} aria-hidden>
            <Polaroid c={n} tilt={k ? 3 : -3} />
          </div>
        ))}
        <div
          key={c.id}
          className="relative cursor-grab touch-pan-y active:cursor-grabbing"
          style={{ transform: `translateX(${x}px) rotate(${x / 18}deg)`, transition: start.current === null ? "transform 260ms var(--ease)" : "none" }}
          onPointerDown={(e) => {
            start.current = e.clientX;
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => start.current !== null && setDx(e.clientX - start.current)}
          onPointerUp={() => {
            start.current = null;
            if (dx > 100) decide(true);
            else if (dx < -100) decide(false);
            else setDx(0);
          }}
          onPointerCancel={() => {
            start.current = null;
            setDx(0);
          }}
        >
          <Polaroid c={c} />
          <div className="pointer-events-none absolute left-4 top-4 rounded-lg border-4 px-3 py-1 font-display text-[26px] text-[#7cc47f]" style={{ borderColor: "#7cc47f", opacity: Math.max(0, dx / 100), transform: "rotate(-12deg)" }}>
            {t("yes")}
          </div>
          <div className="pointer-events-none absolute right-4 top-4 rounded-lg border-4 px-3 py-1 font-display text-[26px] text-[#ef6f7f]" style={{ borderColor: "#ef6f7f", opacity: Math.max(0, -dx / 100), transform: "rotate(12deg)" }}>
            {t("no")}
          </div>
        </div>
      </div>

      <div className="space-y-2" aria-live="polite">
        <p className="m-0 text-[15px] dim">{why}</p>
        {c.aliases.length > 0 && (
          <p className="m-0 flex flex-wrap justify-center gap-1.5 text-[14px]">
            <span className="muted">{t("alsoCalled")}:</span>
            {c.aliases.slice(0, 4).map((a) => (
              <span key={a} className="tag">
                {a}
              </span>
            ))}
          </p>
        )}
        <p className="muted m-0 text-[13px]">{t("cardOf", { i: i + 1, n: cards.length })}</p>
      </div>

      <div className="mx-auto flex max-w-[360px] gap-3">
        <button className="btn btn-ghost flex-1 text-[18px]" onClick={() => decide(false)} aria-label={`${t("no")}: ${c.name}`}>
          ✕ {t("no")}
        </button>
        <button className="btn btn-primary flex-[1.4] text-[18px]" onClick={() => decide(true)} aria-label={`${t("yes")} ${c.name}`}>
          ✓ {t("yes")}
        </button>
      </div>
      <button className="min-h-[44px] text-[15px] underline underline-offset-4 dim" onClick={onRejectAll}>
        {t("noneOfThese")}
      </button>
    </section>
  );
}

function Aha({ phase, c }: { phase: "ring" | "still" | "found"; c: Candidate }) {
  const { t } = useT();
  if (phase === "ring")
    return (
      <div className="grid min-h-[75dvh] place-items-center">
        <div className="pop w-[min(78vw,320px)] rounded-[10px]" style={{ animation: "pulse-ring 1s ease-out 2" }}>
          <Polaroid c={c} />
        </div>
      </div>
    );
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--night)]">
      {phase === "found" && (
        <p className="rise font-display text-[clamp(48px,14vw,96px)] text-[var(--turmeric)]" style={{ textShadow: "0 0 40px var(--glow)" }}>
          {t("found")}
        </p>
      )}
    </div>
  );
}

function Refine({ need, onAnswer }: { need: { questionId: string; options: string[] }; onAnswer: (a: string | null) => void }) {
  const { t } = useT();
  const [sent, setSent] = useState(false);
  const answer = (a: string | null) => {
    setSent(true);
    onAnswer(a);
  };
  return (
    <section className="narrow mx-auto space-y-6 py-10 text-center" aria-busy={sent}>
      <Diya size={72} />
      <h1 className="text-[clamp(28px,7vw,40px)]">{t(`q_${need.questionId}` as CopyKey)}</h1>
      <div className="flex flex-wrap justify-center gap-3">
        {need.options.map((o) => (
          <button key={o} className="chip !min-h-[52px] !px-5 !text-[18px]" disabled={sent} onClick={() => answer(o)}>
            {t(`o_${o}` as CopyKey)}
          </button>
        ))}
        <button className="chip !min-h-[52px] !px-5 !text-[18px]" disabled={sent} onClick={() => answer(null)}>
          {t("dontKnow")}
        </button>
      </div>
    </section>
  );
}

function NoMatch({ flagships }: { flagships: Flagship[] }) {
  const { t } = useT();
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const tryFlagship = (f: Flagship) => {
    setBusy(f.name);
    startSearch({ text: f.text, festival: "diwali", remembered: false, uiLang: "hinglish" });
    location.reload();
  };
  return (
    <section className="narrow mx-auto space-y-6 py-10 text-center">
      <Diya size={72} />
      <h1 className="text-[clamp(28px,7vw,40px)]">{t("noMatch")}</h1>
      <p className="dim">{t("noMatchHelp")}</p>
      {flagships.length > 0 && (
        <div className="space-y-2">
          <p className="muted text-[14px]">{t("maybeThis")}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {flagships.map((f) => (
              <button key={f.name} className="chip" disabled={!!busy} onClick={() => tryFlagship(f)}>
                {busy === f.name ? "…" : f.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <Link href="/#describe" className="btn btn-primary">
        {t("tryAgain")}
      </Link>
    </section>
  );
}

function Oops({ code }: { code: string }) {
  const { t } = useT();
  return (
    <section className="narrow mx-auto space-y-6 py-16 text-center">
      <Diya size={72} lit={false} />
      <h1 className="text-[30px]">{code === "NO_RECORDINGS" ? t("noRecordings") : t("error")}</h1>
      <Link href="/#describe" className="btn btn-primary">
        {t("tryAgain")}
      </Link>
    </section>
  );
}

/* ---------------- Reveal: scenes A–F ---------------- */

export function Reveal({ s, c, input, you, setYou, home, setHome, onCity }: { s: State; c: Candidate; input: MemoryInput; you: City | null; setYou: (c: City | null) => void; home: City | null; setHome: (c: City | null) => void; onCity?: (c: City) => void }) {
  const { t, maker } = useT();
  const names = s.reveal.aliases?.payload as AliasMap | null | undefined;
  const hb = s.reveal.heartbeat?.payload as Heartbeat | null | undefined;
  const steps = s.reveal.steps?.payload as StepsPack | null | undefined;
  const shops = s.reveal.shops?.payload as ShopsPack | null | undefined;
  const makerLabel = maker(input.maker);
  const nNames = names ? names.names.length : 0;

  const chip = (scene: Scene, engine: string) => {
    const r = s.reveal[scene];
    if (!r) return null;
    return <SourceChip engine={engine} source={r.source === "recorded" ? "recorded" : (r.provenance[0]?.source ?? "live")} recordedAt={r.recordedAt ?? r.provenance[0]?.recordedAt} />;
  };
  const pending = (scene: Scene, label: CopyKey) => !s.reveal[scene] && <Skeleton label={t(label)} />;
  const failed = (scene: Scene) => s.reveal[scene] && !s.reveal[scene]!.payload && !s.reveal[scene]!.needCity && <p className="card p-5 dim">{t("sceneFail")}</p>;

  return (
    <div className="divide-y divide-[var(--line)]">
      <section className="grid items-center gap-8 pb-10 pt-4 md:grid-cols-[minmax(0,360px)_1fr]" aria-labelledby="hero-h">
        <div className="rise mx-auto w-[min(80vw,340px)]">
          <Polaroid c={c} tilt={-2} big />
        </div>
        <div className="rise space-y-4 text-center md:text-left" style={{ animationDelay: "200ms" }}>
          <p className="eyebrow">{t("found")}</p>
          <h1 id="hero-h" className="text-[clamp(36px,9vw,64px)] text-[var(--turmeric)]">
            {input.remembered ? t("heroGentle", { maker: makerLabel, dish: c.name }) : t("heroOf", { maker: makerLabel, dish: c.name })}
          </h1>
          {nNames > 1 && <a href="#names-h" className="tag !text-[15px]">{t("namesChip", { n: nNames })} ↓</a>}
        </div>
      </section>

      <SceneShell id="names" eyebrow="Google Trends" title={nNames > 1 ? t("namesTitle", { n: nNames }) : t("namesAcross")} sub={t("namesSub")} chip={chip("aliases", "google_trends")}>
        {pending("aliases", "st_aliases")}
        {names ? <NamesMap map={names} /> : s.reveal.aliases && <p className="card p-5 dim">{t("noNames")}</p>}
      </SceneShell>

      <SceneShell id="heartbeat" title={t("heartTitle")} sub={hb ? t("heartSub", { y: hb.years, f: hb.festiveYears }) : undefined} chip={chip("heartbeat", "google_trends")}>
        {pending("heartbeat", "st_heartbeat")}
        {hb && <HeartbeatChart hb={hb} />}
        {failed("heartbeat")}
      </SceneShell>

      <SceneShell id="steps" title={t("stepsTitle")} chip={chip("steps", "youtube")}>
        {pending("steps", "st_steps")}
        {steps && <Steps pack={steps} makerLabel={makerLabel} />}
        {failed("steps")}
      </SceneShell>

      <SceneShell id="shops" title={t("shopsTitle")} sub={shops ? t("shopsSub", { city: shops.city }) : undefined} chip={chip("shops", "google_maps")}>
        {pending("shops", "st_shops")}
        {s.reveal.shops?.needCity ? onCity && <ShopsCity onPick={(city) => (setYou(city), onCity(city))} /> : shops ? <Shops pack={shops} /> : failed("shops")}
      </SceneShell>

      <DooriScene you={you} setYou={setYou} home={home} setHome={setHome} makerLabel={makerLabel} gentle={!!input.remembered} />

      <ShareSection
        c={c}
        input={input}
        card={{
          maker: makerLabel,
          dish: c.name,
          native: c.nameNative,
          gentle: !!input.remembered,
          names: Object.entries(names?.byState ?? {}).map(([state, v]) => ({ state, name: v.name })),
          km: you && home ? Math.round(haversineKm(you, home)) : undefined,
          hb: hb ? { festive: hb.festiveYears, years: hb.years } : undefined,
          from: you?.name,
          to: home?.name,
          steps,
        }}
      />
    </div>
  );
}

function ShopsCity({ onPick }: { onPick: (c: City) => void }) {
  const { t } = useT();
  const [city, setCity] = useState<City | null>(null);
  const [sent, setSent] = useState(false);
  return (
    <div className="card space-y-3 p-5">
      <label htmlFor="shop-city" className="field-label">
        {t("needCity")}
      </label>
      <PlacePicker id="shop-city" value={city} onChange={setCity} locate />
      <button
        className="btn btn-primary"
        disabled={!city || sent}
        onClick={() => {
          setSent(true);
          onPick(city!);
        }}
      >
        {sent ? t("st_shops") : t("showShops")}
      </button>
    </div>
  );
}

function DooriScene({ you, setYou, home, setHome, makerLabel, gentle }: { you: City | null; setYou: (c: City | null) => void; home: City | null; setHome: (c: City | null) => void; makerLabel: string; gentle: boolean }) {
  const { t } = useT();
  return (
    <section aria-label={t("dooriEyebrow")} className="py-10">
      <p className="eyebrow mb-4 text-center">{t("dooriEyebrow")}</p>
      {you && home ? (
        <Doori you={you} home={home} makerLabel={makerLabel} gentle={gentle} />
      ) : (
        <div className="card mx-auto max-w-[640px] space-y-5 p-6">
          <p className="m-0 text-center text-[18px] dim">{t("dooriAsk")}</p>
          <div>
            <label htmlFor="d-home" className="field-label">
              {t("homeQ", { maker: makerLabel })}
            </label>
            <PlacePicker id="d-home" value={home} onChange={setHome} mapPick placeholder={t("homePh")} />
          </div>
          <div>
            <label htmlFor="d-you" className="field-label">
              {t("cityQ")}
            </label>
            <PlacePicker id="d-you" value={you} onChange={setYou} locate />
          </div>
        </div>
      )}
    </section>
  );
}

function ShareSection({ c, input, card }: { c: Candidate; input: MemoryInput; card: CardData }) {
  const { t, maker } = useT();
  return (
    <section aria-labelledby="keep-h" className="py-10">
      <div className="mx-auto max-w-[900px] space-y-4">
        <div className="text-center">
          <h2 id="keep-h" className="text-[30px]">
            {t("keepTitle")}
          </h2>
          <p className="dim m-0">{t("keepSub")}</p>
        </div>
        <ShareSheet card={card} path="/" content="result" title={t("shareTitle", { maker: maker(input.maker), dish: c.name })} text={t("shareCaption", { maker: maker(input.maker), dish: c.name })} />
      </div>
      <div className="mt-8 text-center">
        <Link href="/#describe" className="btn btn-ghost">
          {t("newSearch")}
        </Link>
      </div>
    </section>
  );
}
