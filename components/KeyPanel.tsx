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

export const openKeyPanel = () => window.dispatchEvent(new Event("yr-key-open"));

/** Header button + dialog. Only shown on public deploys (NEXT_PUBLIC_VERCEL_DEPLOY=true). */
export function KeyPanel() {
  const { t } = useT();
  const key = useOwnKey();
  const dlg = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"" | "checking" | "ok" | "bad" | "format">("");
  const [info, setInfo] = useState({ left: 0, plan: "" });

  useEffect(() => {
    const open = () => dlg.current?.showModal();
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
  };

  return (
    <>
      <button className="chip !min-h-[44px]" onClick={() => dlg.current?.showModal()} aria-haspopup="dialog">
        🔑 {key ? t("keyLive") : t("keyBtn")}
        {key && <span className="inline-block h-2 w-2 rounded-full bg-[#7cc47f]" aria-hidden />}
      </button>
      <dialog
        ref={dlg}
        aria-labelledby="key-h"
        className="m-auto w-[min(560px,calc(100vw-24px))] rounded-[22px] border-0 p-0 text-[var(--ink)] backdrop:bg-black/60 backdrop:backdrop-blur-sm"
        onClick={(e) => e.target === dlg.current && dlg.current?.close()}
      >
        <div className="paper space-y-4 !rounded-none p-6 sm:p-8">
          <h2 id="key-h" className="text-[28px]">
            🔑 {t("keyTitle")}
          </h2>
          <p className="m-0 flex gap-2 rounded-2xl p-3 text-[15px] font-medium" style={{ background: "rgb(79 122 56 / .14)", border: "1px solid rgb(79 122 56 / .4)", color: "#2f4f20" }}>
            <span aria-hidden>🔒</span>
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
                {status === "checking" ? t("keyChecking") : t("keyCheck")}
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
          <form method="dialog" className="text-right">
            <button className="btn btn-sm" style={{ background: "var(--ink)", color: "var(--paper)" }}>
              {t("close")}
            </button>
          </form>
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
    <button onClick={openKeyPanel} className="w-full rounded-2xl p-3 text-left text-[14px]" style={{ background: "rgb(255 200 61 / .1)", border: "1px solid rgb(255 200 61 / .3)", color: "var(--turmeric)" }}>
      🔑 {t("keyBanner")}
    </button>
  );
}
