"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MAKER_LABEL, pick, type CopyKey } from "@/lib/copy";
import { tink } from "@/lib/sound";
import { startSearch } from "@/lib/stream";
import { MAKERS, type City, type Maker } from "@/lib/types";
import { Diya } from "./Diya";
import { KeyBanner } from "./KeyPanel";
import { PlacePicker } from "./PlacePicker";
import { Header, LangToggle, useT } from "./Lang";

const SENSES: [CopyKey, CopyKey][] = [
  ["senseSmell", "senseSmellIns"], ["senseTaste", "senseTasteIns"], ["senseShape", "senseShapeIns"],
  ["senseColour", "senseColourIns"], ["senseSound", "senseSoundIns"],
];
const MAX = 600;

export function Home() {
  const [stage, setStage] = useState<"entry" | "describe">("entry");
  useEffect(() => {
    try {
      if (sessionStorage.getItem("yr-entered") || location.hash === "#describe") setStage("describe");
    } catch {}
  }, []);
  const enter = () => {
    tink();
    try {
      sessionStorage.setItem("yr-entered", "1");
    } catch {}
    setStage("describe");
  };
  return stage === "entry" ? <Entry onEnter={enter} /> : <Describe />;
}

function Entry({ onEnter }: { onEnter: () => void }) {
  const { t } = useT();
  return (
    <main id="main" className="relative flex min-h-[100dvh] flex-col items-center justify-between overflow-hidden px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-6 text-center">
      <div className="flex w-full max-w-[640px] justify-end">
        <LangToggle />
      </div>
      <div className="flex flex-col items-center gap-6">
        <div className="pop" style={{ filter: "drop-shadow(0 0 40px rgb(255 160 50 / .45))" }}>
          <Diya size={132} label="Diya" />
        </div>
        <div className="space-y-3">
          <p className="rise font-display text-[clamp(28px,7vw,44px)]" style={{ animationDelay: "300ms" }}>
            {t("entry1")}
          </p>
          <p className="rise font-display text-[clamp(22px,5.4vw,34px)] text-[var(--turmeric)]" style={{ animationDelay: "1100ms" }}>
            {t("entry2")}
          </p>
          <p className="rise mx-auto max-w-[30ch] text-[17px] dim" style={{ animationDelay: "1900ms" }}>
            {t("entry3")}
          </p>
        </div>
      </div>
      <div className="rise flex w-full max-w-[420px] flex-col items-center gap-3" style={{ animationDelay: "2400ms" }}>
        <button className="btn btn-primary btn-block text-[19px]" onClick={onEnter} autoFocus>
          {t("remember")} <span aria-hidden>→</span>
        </button>
        <p className="muted text-[14px]">{t("tagline")}</p>
      </div>
    </main>
  );
}

function Describe() {
  const { t, lang } = useT();
  const router = useRouter();
  const ta = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [maker, setMaker] = useState<Maker>("nani");
  const [home, setHome] = useState<City | null>(null);
  const [city, setCity] = useState<City | null>(null);
  const [remembered, setRemembered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ex, setEx] = useState(0);

  useEffect(() => {
    try {
      const s = JSON.parse(sessionStorage.getItem("yr-last") ?? "null");
      if (s) {
        setText(s.text ?? "");
        setMaker(s.maker ?? "nani");
        setHome(s.home ?? null);
        setCity(s.city ?? null);
        setRemembered(!!s.remembered);
      }
    } catch {}
    const id = setInterval(() => setEx((e) => (e + 1) % 3), 4500);
    return () => clearInterval(id);
  }, []);

  const insert = (s: string) => {
    const el = ta.current;
    const at = el?.selectionStart ?? text.length;
    const before = text.slice(0, at);
    const sep = before && !/\s$/.test(before) ? (/[.,!?।]$/.test(before) ? " " : ", ") : "";
    const next = (before + sep + s + text.slice(at)).slice(0, MAX);
    setText(next);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = (before + sep + s).length;
      el?.setSelectionRange(pos, pos);
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().length < 8) {
      setErr(t("tooShort"));
      ta.current?.focus();
      return;
    }
    setBusy(true);
    setErr("");
    const payload = { text: text.trim(), maker, home: home ?? undefined, remembered, city: city ?? undefined, uiLang: lang };
    try {
      sessionStorage.setItem("yr-last", JSON.stringify(payload));
    } catch {}
    startSearch({ ...payload, festival: "diwali", remembered });
    tink();
    router.push("/i");
  };

  const examples = [t("ex1"), t("ex2"), t("ex3")];
  const left = MAX - text.length;

  return (
    <>
      <a href="#memory" className="skip-link">
        {t("skipToContent")}
      </a>
      <Header />
      <main id="main" className="wrap narrow pb-40 pt-6 sm:pt-10">
        <form onSubmit={submit} noValidate className="space-y-8">
          <div className="rise space-y-2">
            <h1 className="text-[clamp(30px,7.5vw,42px)]">{t("describeTitle")}</h1>
            <p className="dim">{t("describeHelp")}</p>
            <div className="pt-1 sm:hidden">
              <LangToggle />
            </div>
            <KeyBanner />
          </div>

          <div className="rise space-y-3" style={{ animationDelay: "120ms" }}>
            <label htmlFor="memory" className="sr-only">
              {t("memoryLabel")}
            </label>
            <div className="paper relative px-5 pb-10 pt-4">
              <textarea
                id="memory"
                ref={ta}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX + 200))}
                rows={6}
                dir="auto"
                placeholder={examples[ex]}
                aria-describedby="memory-count memory-err"
                className="hand block w-full resize-none border-0 bg-transparent text-[21px] leading-[34px] text-[var(--ink)] placeholder:text-[#9a7a5c] focus:outline-none"
                style={{ minHeight: 34 * 6 }}
              />
              <p id="memory-count" className="absolute bottom-3 right-5 text-[13px]" style={{ color: left < 0 ? "var(--kumkum)" : "var(--ink-dim)" }} aria-live="polite">
                {left < 0 ? t("trimmed") : left < 120 ? t("charsLeft", { n: left }) : ""}
              </p>
            </div>
            <div>
              <p className="muted mb-2 text-[14px]">{t("senses")}</p>
              <div className="flex flex-wrap gap-2">
                {SENSES.map(([label, ins]) => (
                  <button type="button" key={label} className="chip" onClick={() => insert(t(ins))}>
                    + {t(label)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <fieldset className="rise space-y-3" style={{ animationDelay: "200ms" }}>
            <legend className="field-label">{t("makerQ")}</legend>
            <div role="radiogroup" aria-label={t("makerQ")} className="flex flex-wrap gap-2">
              {MAKERS.map((m) => (
                <button type="button" role="radio" key={m} aria-checked={maker === m} className="chip" onClick={() => setMaker(m)}>
                  {m === "other" ? t("makerOther") : pick(lang, MAKER_LABEL[m])}
                </button>
              ))}
            </div>
            <label className="flex min-h-[48px] cursor-pointer items-start gap-3 rounded-2xl p-3" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
              <input type="checkbox" checked={remembered} onChange={(e) => setRemembered(e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--marigold)]" />
              <span>
                <span className="block font-medium">{t("remembered")}</span>
                <span className="muted text-[14px]">{t("rememberedHelp")}</span>
              </span>
            </label>
          </fieldset>

          <div className="rise" style={{ animationDelay: "260ms" }}>
            <label htmlFor="home" className="field-label">
              {t("homeQ", { maker: maker === "other" ? t("makerOther") : pick(lang, MAKER_LABEL[maker]) })}
            </label>
            <p id="home-help" className="muted -mt-1 mb-3 text-[14px]">
              {t("homeHelp")}
            </p>
            <PlacePicker id="home" value={home} onChange={setHome} describedBy="home-help" mapPick placeholder={t("homePh")} />
          </div>

          <div className="rise" style={{ animationDelay: "320ms" }}>
            <label htmlFor="city" className="field-label">
              {t("cityQ")}
            </label>
            <p id="city-help" className="muted -mt-1 mb-3 text-[14px]">
              {t("cityHelp")}
            </p>
            <PlacePicker id="city" value={city} onChange={setCity} describedBy="city-help" locate placeholder={t("cityNone")} />
          </div>

          <p id="memory-err" role="alert" className="min-h-[1.5em] font-medium text-[#ff8a80]">
            {err}
          </p>

          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--line)] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4" style={{ background: "linear-gradient(180deg, transparent, var(--night) 30%)", backdropFilter: "blur(8px)" }}>
            <div className="mx-auto max-w-[640px]">
              <button type="submit" className="btn btn-primary btn-block text-[19px]" disabled={busy}>
                {busy ? <Diya size={28} /> : null}
                {t("find")} <span aria-hidden>→</span>
              </button>
            </div>
          </div>
        </form>
      </main>
    </>
  );
}
