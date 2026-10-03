"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { haversineKm } from "@/lib/geo";
import { deleteResult, getResult, listResults, type HistoryEntry } from "@/lib/history";
import type { AliasMap, City } from "@/lib/types";
import { Diya } from "./Diya";
import { Drawer } from "./Drawer";
import { emptyState, Reveal } from "./Investigation";
import { Header, useT } from "./Lang";
import { Polaroid } from "./Scenes";

export function HistoryPage() {
  const { t } = useT();
  const [id, setId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const read = () => setId(new URLSearchParams(location.search).get("id"));
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  const go = (next: string | null) => {
    history.pushState(null, "", next ? `/history?id=${encodeURIComponent(next)}` : "/history");
    setId(next);
    window.scrollTo(0, 0);
  };
  if (id === undefined) return null;
  return (
    <>
      <Header />
      <main id="main" className="wrap pb-28 pt-4 sm:pt-8">
        {id ? <Saved id={id} onBack={() => go(null)} /> : <List onOpen={go} />}
      </main>
      {!id && <p className="sr-only">{t("historySub")}</p>}
    </>
  );
}

function List({ onOpen }: { onOpen: (id: string) => void }) {
  const { t, maker } = useT();
  const [items, setItems] = useState<HistoryEntry[] | null>(null);
  useEffect(() => {
    void listResults().then(setItems);
  }, []);
  const remove = async (id: string) => {
    await deleteResult(id);
    setItems((xs) => xs?.filter((x) => x.id !== id) ?? null);
  };
  if (!items) return null;
  return (
    <section aria-labelledby="hist-h" className="space-y-6">
      <div className="space-y-2">
        <h1 id="hist-h" className="text-[clamp(30px,7vw,44px)]">
          📖 {t("historyTitle")}
        </h1>
        <p className="dim m-0 max-w-[60ch]">🔒 {t("historySub")}</p>
      </div>
      {items.length === 0 ? (
        <div className="card grid place-items-center gap-4 p-10 text-center">
          <Diya size={72} lit={false} />
          <p className="dim m-0">{t("historyEmpty")}</p>
          <Link href="/#describe" className="btn btn-primary">
            {t("find")} →
          </Link>
        </div>
      ) : (
        <ul className="m-0 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((e) => {
            const names = (e.reveal.aliases?.payload as AliasMap | null | undefined)?.names.length ?? 0;
            const km = e.you && e.home ? Math.round(haversineKm(e.you, e.home)) : null;
            return (
              <li key={e.id} className="card flex flex-col gap-4 p-4">
                <button className="text-left" onClick={() => onOpen(e.id)} aria-label={`${t("historyOpen")}: ${e.candidate.name}`}>
                  <div className="mx-auto w-[200px]">
                    <Polaroid c={e.candidate} tilt={-2} />
                  </div>
                </button>
                <div className="space-y-1">
                  <p className="font-display m-0 text-[24px] text-[var(--turmeric)]">{e.candidate.name}</p>
                  <p className="muted m-0 text-[13px]">
                    {maker(e.input.maker)} · {new Date(e.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  <p className="hand m-0 line-clamp-2 text-[17px] text-[var(--text-dim)]" dir="auto">
                    “{e.input.text}”
                  </p>
                  <p className="m-0 flex flex-wrap gap-1.5 pt-1">
                    {names > 1 && <span className="tag">{t("namesChip", { n: names })}</span>}
                    {km !== null && <span className="tag">{t("cardDistance", { km: km.toLocaleString("en-IN") })}</span>}
                  </p>
                </div>
                <div className="mt-auto flex gap-2">
                  <button className="btn btn-primary btn-sm flex-1" onClick={() => onOpen(e.id)}>
                    {t("historyOpen")}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => remove(e.id)} aria-label={`${t("historyDelete")}: ${e.candidate.name}`}>
                    {t("historyDelete")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Saved({ id, onBack }: { id: string; onBack: () => void }) {
  const { t } = useT();
  const [e, setE] = useState<HistoryEntry | null | undefined>(undefined);
  const [you, setYou] = useState<City | null>(null);
  const [home, setHome] = useState<City | null>(null);
  useEffect(() => {
    void getResult(id).then((r) => {
      setE(r ?? null);
      setYou(r?.you ?? null);
      setHome(r?.home ?? null);
    });
  }, [id]);
  if (e === undefined) return null;
  return (
    <div className="space-y-4">
      <button className="btn btn-ghost btn-sm" onClick={onBack}>
        {t("historyBack")}
      </button>
      {e ? (
        <>
          <Reveal s={{ ...emptyState, reveal: e.reveal, calls: e.calls, revealDone: true }} c={e.candidate} input={e.input} you={you} setYou={setYou} home={home} setHome={setHome} />
          <Drawer calls={e.calls} />
        </>
      ) : (
        <p className="card p-6 dim">{t("historyMissing")}</p>
      )}
    </div>
  );
}
