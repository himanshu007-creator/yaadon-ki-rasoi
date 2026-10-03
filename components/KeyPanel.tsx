"use client";
import { useEffect, useRef, useState } from "react";
import { deployMode, getOwnKey, setOwnKey } from "@/lib/ownKey";
import { useT } from "./Lang";

export function useOwnKey() {
  const [key, setKey] = useState("");
  useEffect(() => {
    const sync = () => setKey(getOwnKey());
    sync();
    window.addEventListener("yr-key", sync);
    return () => window.removeEventListener("yr-key", sync);
  }, []);
  return key;
}

// Opened from submit with a key missing: the search continues once a key is saved (or the visitor picks the demo).
let then: (() => void) | null = null;
export const openKeyPanel = (onReady?: () => void) => {
  then = onReady ?? null;
  window.dispatchEvent(new Event("yr-key-open"));
};

/** Header button + dialog. Only shown on public deploys (NEXT_PUBLIC_VERCEL_DEPLOY=true). */
export function KeyPanel() {
  const { t } = useT();
  const key = useOwnKey();
  const dlg = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"" | "checking" | "ok" | "bad" | "format">("");
  const [info, setInfo] = useState({ left: 0, plan: "" });
  const [gate, setGate] = useState(false);

  useEffect(() => {
    const open = () => (setGate(!!then), setStatus(""), dlg.current?.showModal());
    window.addEventListener("yr-key-open", open);
    return () => window.removeEventListener("yr-key-open", open);
  }, []);

  if (!deployMode) return null;

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    const k = draft.trim();
    if (!/^[a-f0-9]{64}$/i.test(k)) return setStatus("format");
    setStatus("checking");
    const r = await fetch("/api/key-check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: k }) });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) return setStatus("bad");
    setOwnKey(k);
    setInfo({ left: j.left, plan: j.plan });
    setStatus("ok");
    setDraft("");
    if (gate) proceed();
  };
  const proceed = () => {
    const go = then;
    then = null;
    dlg.current?.close();
    go?.();
  };

  return (
    <>
      <button className="chip !min-h-[44px]" onClick={() => openKeyPanel()} aria-haspopup="dialog">
        🔑 {key ? t("keyLive") : t("keyBtn")}
        {key && <span className="inline-block h-2 w-2 rounded-full bg-[#7cc47f]" aria-hidden />}
      </button>
      <dialog
        ref={dlg}
        aria-labelledby="key-h"
        className="m-auto w-[min(560px,calc(100vw-24px))] rounded-[22px] border-0 p-0 text-[var(--ink)] backdrop:bg-black/60 backdrop:backdrop-blur-sm"
        onClick={(e) => e.target === dlg.current && dlg.current?.close()}
        onClose={() => (then = null)}
      >
        <div className="paper space-y-4 !rounded-none p-6 sm:p-8">
          <h2 id="key-h" className="text-[28px]">
            🔑 {t(gate ? "keyGateTitle" : "keyTitle")}
          </h2>
          <p className="m-0 flex gap-3 rounded-2xl p-4 text-[16px] font-semibold leading-snug" style={{ background: "rgb(79 122 56 / .18)", border: "2px solid rgb(79 122 56 / .55)", color: "#24401a" }}>
            <span aria-hidden className="text-[22px]">🔒</span>
            <span>{t("keyPrivacy")}</span>
          </p>
          <p className="m-0 text-[15px] text-[var(--ink-dim)]">{t("keyWhy")}</p>
          <ol className="m-0 list-decimal space-y-1.5 pl-5 text-[15px]">
            <li>
              {t("keyStep1")}{" "}
              <a href="https://serpapi.com/users/sign_up" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#b34700]">
                serpapi.com ↗
              </a>
            </li>
            <li>
              {t("keyStep2")}{" "}
              <a href="https://serpapi.com/manage-api-key" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#b34700]">
                manage-api-key ↗
              </a>
            </li>
            <li>{t("keyStep3")}</li>
          </ol>
          <p className="m-0 text-[13px] text-[var(--ink-dim)]">{t("keyCost")}</p>
          <form onSubmit={check} className="space-y-2">
            <label htmlFor="own-key" className="block font-semibold">
              {t("keyLabel")}
            </label>
            <input
              id="own-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              className="input !bg-white font-mono !text-[15px] !text-[var(--ink)]"
              placeholder={key ? "••••••••••••••••" : "e.g. 3f9a…"}
              value={draft}
              onChange={(e) => (setDraft(e.target.value), setStatus(""))}
            />
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" disabled={!draft.trim() || status === "checking"}>
                {status === "checking" ? t("keyChecking") : t(gate ? "keyCheckGo" : "keyCheck")}
              </button>
              {key && (
                <button type="button" className="btn btn-ghost !text-[var(--ink)]" onClick={() => (setOwnKey(""), setStatus(""))}>
                  {t("keyRemove")}
                </button>
              )}
            </div>
            <p role="status" className="m-0 min-h-[1.4em] text-[14px] font-medium">
              {status === "ok" && <span className="text-[var(--mehendi)]">{t("keyOk", { left: info.left, plan: info.plan })}</span>}
              {status === "bad" && <span className="text-[var(--kumkum)]">{t("keyBad")}</span>}
              {status === "format" && <span className="text-[var(--kumkum)]">{t("keyFormat")}</span>}
            </p>
          </form>
          {gate ? (
            <div className="border-t border-[rgb(0_0_0/.12)] pt-3 text-right">
              <button type="button" className="text-[14px] font-semibold text-[var(--ink-dim)] underline underline-offset-4" onClick={proceed}>
                {t("keySkipDemo")}
              </button>
            </div>
          ) : (
            <form method="dialog" className="text-right">
              <button className="btn btn-sm" style={{ background: "var(--ink)", color: "var(--paper)" }}>
                {t("close")}
              </button>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}

/** Gentle nudge on the describe screen when a public deploy has no visitor key yet. */
export function KeyBanner() {
  const { t } = useT();
  const key = useOwnKey();
  if (!deployMode || key) return null;
  return (
    <button type="button" onClick={() => openKeyPanel()} className="w-full rounded-2xl p-3 text-left text-[14px]" style={{ background: "rgb(255 200 61 / .1)", border: "1px solid rgb(255 200 61 / .3)", color: "var(--turmeric)" }}>
      🔑 {t("keyBanner")}
    </button>
  );
}
