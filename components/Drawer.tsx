"use client";
import { useEffect, useRef, useState } from "react";
import { ownKeyHeaders } from "@/lib/ownKey";
import type { CallMeta } from "@/lib/serp";
import { useT } from "./Lang";
import { ENGINE_NAME } from "./Scenes";

const keyParam = (p: CallMeta["params"]) => String(p.q ?? p.search_query ?? p.v ?? p.data_id ?? "");

export function Drawer({ calls }: { calls: CallMeta[] }) {
  const { t } = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const [ops, setOps] = useState<{ mode: string; usedToday: number; cap: number; llm: boolean; ownKey: boolean } | null>(null);
  useEffect(() => {
    fetch("/api/ops", { headers: ownKeyHeaders() }).then((r) => r.json()).then(setOps).catch(() => {});
  }, [calls.length]);

  const byEngine = new Map<string, number>();
  for (const c of calls) byEngine.set(c.engine, (byEngine.get(c.engine) ?? 0) + 1);
  const credits = calls.reduce((s, c) => s + c.credits, 0);
  const hits = calls.filter((c) => c.source !== "live").length;

  return (
    <>
      <button
        className="btn btn-ghost btn-sm fixed bottom-[max(16px,env(safe-area-inset-bottom))] right-4 z-30 shadow-lg"
        style={{ background: "var(--surface-2)" }}
        onClick={() => ref.current?.showModal()}
        aria-haspopup="dialog"
      >
        <span aria-hidden>🧾</span> {t("drawer")}
        <span className="tag !px-2">{calls.length}</span>
      </button>
      <dialog
        ref={ref}
        className="m-auto max-h-[85dvh] w-[min(720px,calc(100vw-24px))] rounded-[22px] border-0 p-0 text-[var(--ink)] backdrop:bg-black/60 backdrop:backdrop-blur-sm"
        aria-labelledby="drawer-h"
        onClick={(e) => e.target === ref.current && ref.current?.close()}
      >
        <div className="paper !rounded-none p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="drawer-h" className="text-[30px]">
                {t("drawer")}
              </h2>
              <p className="m-0 text-[15px] text-[var(--ink-dim)]">{t("drawerSub")}</p>
            </div>
            <form method="dialog">
              <button className="btn btn-sm" style={{ background: "var(--ink)", color: "var(--paper)" }}>
                {t("close")}
              </button>
            </form>
          </div>
          <p className="hand mt-5 text-[21px] leading-[34px]">
            <strong>{t("ingredients")}:</strong> {[...byEngine].map(([e, n]) => `${n} × ${ENGINE_NAME[e] ?? e}`).join(", ") || "—"}
          </p>
          <p className="hand text-[21px] leading-[34px]">{t("credits", { c: credits, h: hits })}</p>
          {ops && (
            <p className="m-0 text-[13px] text-[var(--ink-dim)]">
              mode: <b>{ops.mode}</b> · {ops.ownKey ? "your own SerpApi key" : `today ${ops.usedToday}/${ops.cap} credits`} · LLM: {ops.llm ? "Claude Haiku 4.5 (grounded)" : "off (rules)"}
            </p>
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-[14px]">
              <thead>
                <tr className="border-b border-[rgb(43_26_16/.2)]">
                  <th className="py-2 pr-3 font-semibold">Engine</th>
                  <th className="py-2 pr-3 font-semibold">Query</th>
                  <th className="py-2 pr-3 font-semibold">Source</th>
                  <th className="py-2 pr-3 text-right font-semibold">Cr</th>
                  <th className="py-2 text-right font-semibold">ms</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c, i) => (
                  <tr key={i} className="border-b border-[rgb(43_26_16/.1)] align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <code>{c.engine}</code>
                    </td>
                    <td className="max-w-[260px] py-2 pr-3 break-words">{keyParam(c.params)}</td>
                    <td className="py-2 pr-3">{c.source}</td>
                    <td className="py-2 pr-3 text-right">{c.credits}</td>
                    <td className="py-2 text-right">{c.ms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </dialog>
    </>
  );
}
