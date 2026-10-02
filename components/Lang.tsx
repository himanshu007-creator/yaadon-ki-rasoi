"use client";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { MAKER_LABEL, pick, t as tr, type CopyKey } from "@/lib/copy";
import { soundEnabled, tink } from "@/lib/sound";
import type { Maker, UiLang } from "@/lib/types";
import { Diya } from "./Diya";
import { KeyPanel } from "./KeyPanel";

const Ctx = createContext<{ lang: UiLang; setLang: (l: UiLang) => void }>({ lang: "hinglish", setLang: () => {} });

export function LangProvider({ initial, children }: { initial: UiLang; children: React.ReactNode }) {
  const [lang, set] = useState<UiLang>(initial);
  const setLang = useCallback((l: UiLang) => {
    set(l);
    document.cookie = `lang=${l};path=/;max-age=31536000;samesite=lax`;
  }, []);
  useEffect(() => {
    const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    if ((n.deviceMemory && n.deviceMemory <= 2) || n.connection?.saveData) document.documentElement.classList.add("lite");
  }, []);
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

export function useT() {
  const { lang, setLang } = useContext(Ctx);
  const t = useCallback((k: CopyKey, v?: Record<string, string | number>) => tr(lang, k, v), [lang]);
  const maker = useCallback((m?: Maker) => pick(lang, MAKER_LABEL[m ?? "other"]), [lang]);
  return { lang, setLang, t, maker };
}

const LANGS: { id: UiLang; label: string; lang: string }[] = [
  { id: "hinglish", label: "Hinglish", lang: "en-IN" },
  { id: "en", label: "English", lang: "en" },
];

export function LangToggle() {
  const { lang, setLang, t } = useT();
  return (
    <div role="radiogroup" aria-label={t("language")} className="flex rounded-full border border-[var(--line)] p-1" style={{ background: "var(--surface)" }}>
      {LANGS.map((l) => (
        <button
          key={l.id}
          role="radio"
          aria-checked={lang === l.id}
          lang={l.lang}
          onClick={() => setLang(l.id)}
          className="min-h-[40px] rounded-full px-3 text-[14px] font-semibold transition-colors"
          style={lang === l.id ? { background: "var(--marigold)", color: "#2b1205" } : { color: "var(--text-dim)" }}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

export function SoundToggle() {
  const { t } = useT();
  const [on, setOn] = useState(false);
  useEffect(() => setOn(soundEnabled()), []);
  return (
    <button
      className="grid h-11 w-11 place-items-center rounded-full border border-[var(--line)]"
      style={{ background: "var(--surface)" }}
      aria-pressed={on}
      aria-label={on ? t("soundOn") : t("soundOff")}
      title={on ? t("soundOn") : t("soundOff")}
      onClick={() => {
        const next = !on;
        try {
          localStorage.setItem("yr-sound", next ? "1" : "0");
        } catch {}
        setOn(next);
        if (next) tink();
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
        {on ? <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /> : <path d="m16 9 6 6m0-6-6 6" />}
      </svg>
    </button>
  );
}

export function Header() {
  const { t } = useT();
  return (
    <header className="wrap flex items-center justify-between gap-3 pb-3 pt-5 sm:pt-7">
      <Link href="/" className="flex items-center gap-2 no-underline" aria-label={t("brand")}>
        <Diya size={34} />
        <span className="font-display text-[20px] leading-none">
          {t("brand")}
        </span>
      </Link>
      <div className="flex items-center gap-2">
        <div className="hidden sm:block">
          <LangToggle />
        </div>
        <KeyPanel />
        <SoundToggle />
      </div>
    </header>
  );
}

/** Wrap Devanagari runs with lang="hi" so screen readers pronounce them properly. */
export function L({ children }: { children: string }) {
  return /[ऀ-ॿ]/.test(children) ? <span lang="hi">{children}</span> : <>{children}</>;
}
