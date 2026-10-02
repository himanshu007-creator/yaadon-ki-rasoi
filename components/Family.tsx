"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { pick, RELATIONS } from "@/lib/copy";
import { haptic, tink, whistle } from "@/lib/sound";
import type { Contribution, PublicFamily } from "@/lib/store";
import { Diya } from "./Diya";
import { Header, L, useT } from "./Lang";
import { Polaroid, Steps } from "./Scenes";
import { STATES } from "@/lib/states";
import { ShareSheet } from "./ShareSheet";

type Contrib = Omit<Contribution, "ipHash">;
const json = { "content-type": "application/json" };

/** Concentric rings around the centre diya: 8, then 14, then the rest. */
function ringPositions(n: number) {
  const out: { x: number; y: number }[] = [];
  let k = 0;
  for (const [r, cap] of [[30, 8], [42, 14], [49, 99]] as const) {
    const m = Math.min(cap, n - k);
    for (let j = 0; j < m; j++) {
      const a = -Math.PI / 2 + (2 * Math.PI * j) / m + (r === 42 ? Math.PI / m : 0);
      out.push({ x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) });
    }
    k += m;
    if (k >= n) break;
  }
  return out;
}

export function Family({ initial }: { initial: PublicFamily }) {
  const { t, maker } = useT();
  const [fam, setFam] = useState(initial);
  const [ownerKey, setOwnerKey] = useState<string | null>(null);
  const [mine, setMine] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const slug = fam.slug;

  useEffect(() => {
    try {
      const fromHash = new URLSearchParams(location.hash.slice(1)).get("k");
      if (fromHash) {
        localStorage.setItem(`yr-owner-${slug}`, fromHash);
        history.replaceState(null, "", location.pathname);
      }
      setOwnerKey(localStorage.getItem(`yr-owner-${slug}`));
      setMine(localStorage.getItem(`yr-lit-${slug}`) === "1");
    } catch {}
  }, [slug]);

  useEffect(() => {
    if (!ownerKey) return;
    fetch(`/api/family/${slug}`, { headers: { "x-owner-key": ownerKey } })
      .then((r) => (r.ok ? r.json() : null))
      .then((f) => f && setFam(f))
      .catch(() => {});
  }, [ownerKey, slug]);

  const confirms = fam.contributions.filter((c) => c.kind === "confirm" && !c.hidden);
  const notes = fam.contributions.filter((c) => c.kind === "note" && !c.hidden);
  const makerLabel = maker(fam.maker);
  const gentle = fam.remembered;
  const done = celebrate || !!fam.teenSeetiAt;

  const onLit = (c: Contrib, teenSeeti: boolean) => {
    setFam((f) => ({ ...f, contributions: [...f.contributions, c], count: f.count + (c.kind === "confirm" ? 1 : 0) }));
    if (teenSeeti) {
      whistle(3);
      haptic(40);
      setCelebrate(true);
    }
  };

  return (
    <>
      <Header />
      <main id="main" className="wrap pb-16 pt-4 sm:pt-8">
        {done && (
          <div role="status" className="pop mb-6 rounded-[22px] p-5 text-center" style={{ background: "linear-gradient(135deg, #ffb43c, var(--saffron))", color: "#2b1205" }}>
            <p className="m-0 text-[32px]" aria-hidden>
              🍲🍲🍲
            </p>
            <p className="font-display m-0 text-[clamp(24px,6vw,34px)]">{t("teenSeeti")}</p>
          </div>
        )}

        <div className="grid gap-8 md:grid-cols-[1fr_minmax(0,460px)] md:items-start">
          <div className="space-y-8">
            <header className="space-y-4">
              <h1 className="text-[clamp(30px,7.5vw,46px)]">
                {t(gentle ? "famHeadingGentle" : "famHeading", { owner: fam.ownerName, maker: makerLabel, dish: fam.dish.name })} {gentle ? "🕯" : "🪔"}
              </h1>
              {fam.dish.nameNative && (
                <p className="font-display m-0 text-[28px] text-[var(--turmeric)]">
                  <L>{fam.dish.nameNative}</L>
                </p>
              )}
              {fam.dish.photo && (
                <div className="w-[min(70vw,260px)]">
                  <Polaroid c={{ id: "dish", name: fam.dish.name, aliases: [], supportDocIds: [], matched: [], domains: [], score: 0, photo: fam.dish.photo }} tilt={-2} />
                </div>
              )}
            </header>

            {fam.voice && <Voice src={fam.voice.src} name={fam.voice.name} />}

            <GuestBox slug={slug} gentle={gentle} mine={mine} setMine={setMine} onLit={onLit} />

            {notes.length > 0 && (
              <section aria-labelledby="notes-h" className="space-y-3">
                <h2 id="notes-h" className="text-[26px]">
                  {t("memories")}
                </h2>
                <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
                  {notes.map((n) => (
                    <li key={n.id} className="paper px-5 py-4">
                      <p className="hand m-0 text-[21px] leading-[34px]" dir="auto">
                        “{n.body}”
                      </p>
                      <p className="m-0 text-[14px] text-[var(--ink-dim)]">
                        — {n.name}
                        {n.relation ? `, ${n.relation}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {fam.names.length > 1 && (
              <section aria-labelledby="names-h" className="space-y-3">
                <h2 id="names-h" className="text-[26px]">
                  {t("namesAcross")}
                </h2>
                <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                  {fam.names.map((n) => (
                    <li key={n.state} className="chip !cursor-default">
                      <span className="muted">{n.state}:</span> <span className="capitalize">{n.name}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {fam.steps && fam.steps.steps.length > 0 && (
              <section aria-labelledby="steps-h" className="space-y-3">
                <h2 id="steps-h" className="text-[26px]">
                  {t("stepsTitle")}
                </h2>
                <Steps pack={fam.steps} makerLabel={makerLabel} />
              </section>
            )}
          </div>

          <aside className="space-y-4 md:sticky md:top-4">
            <Wall ownerName={fam.ownerName} confirms={confirms} notes={notes} pulse={celebrate} selected={selected} onSelect={setSelected} />
            <p className="text-center text-[15px] dim">{confirms.length ? t("diyasLit", { n: confirms.length }) : t("firstDiya")} · {t("seetiCount", { n: Math.min(3, confirms.length) })}</p>

          </aside>
        </div>

        <section aria-labelledby="keep-h" className="mt-12 space-y-4">
          <div className="text-center">
            <h2 id="keep-h" className="text-[30px]">
              {t("keepTitle")}
            </h2>
            <p className="dim m-0">{t("keepSub")}</p>
          </div>
          <ShareSheet
            path={`/f/${slug}`}
            content="family"
            title={t("shareTitle", { maker: makerLabel, dish: fam.dish.name })}
            text={t(gentle ? "waTextGentle" : "waText", { maker: makerLabel, dish: fam.dish.name, url: "" }).trim()}
            card={{
              maker: makerLabel,
              dish: fam.dish.name,
              native: fam.dish.nameNative,
              gentle,
              names: fam.names.flatMap((n) => {
                const st = STATES.find((s) => s.name === n.state);
                return st ? [{ state: st.id, name: n.name }] : [];
              }),
              steps: fam.steps,
              notes: notes.map((n) => ({ body: n.body ?? "", name: n.name })),
            }}
          />
        </section>

        {ownerKey && <OwnerTools slug={slug} ownerKey={ownerKey} items={fam.contributions} onChange={setFam} />}

        <footer className="mt-12 space-y-3 border-t border-[var(--line)] pt-6 text-center">
          <p className="muted mx-auto max-w-[52ch] text-[14px]">{t("privacy")}</p>
          <Link href="/" className="btn btn-ghost">
            {t("findYours")}
          </Link>
        </footer>
      </main>
    </>
  );
}

function Wall({ ownerName, confirms, notes, pulse, selected, onSelect }: { ownerName: string; confirms: Contrib[]; notes: Contrib[]; pulse: boolean; selected: string | null; onSelect: (id: string | null) => void }) {
  const { t } = useT();
  const slots = Math.max(3, confirms.length);
  const pos = ringPositions(slots);
  const sel = confirms.find((c) => c.id === selected);
  const selNotes = sel ? notes.filter((n) => n.name === sel.name) : [];
  return (
    <div className="card p-3">
      <div className="relative mx-auto aspect-square w-full max-w-[440px]">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
          {[30, 42].map((r) => (
            <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="rgb(255 159 28 / .22)" strokeWidth=".4" strokeDasharray="1 1.6" />
          ))}
          {Array.from({ length: 12 }, (_, i) => (
            <ellipse key={i} cx="50" cy="36" rx="3.2" ry="9" fill="rgb(198 42 51 / .16)" transform={`rotate(${i * 30} 50 50)`} />
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <ellipse key={i} cx="50" cy="40" rx="2.4" ry="6" fill="rgb(255 200 61 / .18)" transform={`rotate(${i * 45 + 22.5} 50 50)`} />
          ))}
          <circle cx="50" cy="50" r="7" fill="rgb(255 159 28 / .15)" />
        </svg>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <Diya size={64} label={t("foundBy", { owner: ownerName })} />
          <p className="m-0 text-[12px] dim">{t("foundBy", { owner: ownerName })}</p>
        </div>
        {pos.map((p, i) => {
          const c = confirms[i];
          const style = { left: `${p.x}%`, top: `${p.y}%` };
          if (!c)
            return (
              <div key={`slot${i}`} className="absolute -translate-x-1/2 -translate-y-1/2 opacity-60" style={style} aria-hidden>
                <Diya size={40} lit={false} />
              </div>
            );
          return (
            <button
              key={c.id}
              className="pop absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-full p-1"
              style={{ ...style, animation: pulse ? "pulse-ring 1.2s ease-out 3" : undefined }}
              aria-pressed={selected === c.id}
              onClick={() => onSelect(selected === c.id ? null : c.id)}
              aria-label={`${c.name}${c.relation ? `, ${c.relation}` : ""}`}
            >
              <Diya size={40} />
              <span className="max-w-[72px] truncate text-[11px] leading-tight dim">{c.name}</span>
            </button>
          );
        })}
      </div>
      <div aria-live="polite" className="min-h-[24px] px-2 pb-1 text-center">
        {sel && (
          <p className="hand m-0 text-[18px]">
            {sel.name}
            {sel.relation ? ` · ${sel.relation}` : ""}
            {selNotes.map((n) => ` — “${n.body}”`).join("")}
          </p>
        )}
      </div>
    </div>
  );
}

function GuestBox({ slug, gentle, mine, setMine, onLit }: { slug: string; gentle: boolean; mine: boolean; setMine: (b: boolean) => void; onLit: (c: Contrib, teenSeeti: boolean) => void }) {
  const { t, lang } = useT();
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      setName(localStorage.getItem("yr-name") ?? "");
    } catch {}
  }, []);

  const send = async (kind: "confirm" | "note", body?: string) => {
    const res = await fetch(`/api/family/${slug}/contrib`, { method: "POST", headers: json, body: JSON.stringify({ kind, name: name.trim(), relation: relation || undefined, body }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.reason === "family-full" ? "full" : res.status === 429 ? "slow" : "error");
    onLit({ id: j.id, kind, name: name.trim(), relation: relation || undefined, body, hidden: false, createdAt: new Date().toISOString() }, !!j.teenSeeti);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return nameRef.current?.focus();
    setBusy(true);
    setMsg("");
    try {
      if (!mine) {
        await send("confirm");
        tink();
        haptic(12);
        setMine(true);
        localStorage.setItem(`yr-lit-${slug}`, "1");
        localStorage.setItem("yr-name", name.trim());
      }
      if (note.trim()) {
        await send("note", note.trim());
        setNote("");
        setShowNote(false);
      }
      setMsg(mine ? t("sent") : t("lit"));
    } catch (err) {
      const k = (err as Error).message;
      setMsg(k === "full" ? t("full") : k === "slow" ? t("slowDown") : t("error"));
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <h2 className="text-[26px]">{mine ? t(gentle ? "addTadkaGentle" : "addTadka") : t(gentle ? "askConfirmGentle" : "askConfirm")}</h2>
      {!mine && (
        <>
          <div>
            <label htmlFor="g-name" className="field-label">
              {t("nameLabel")}
            </label>
            <input id="g-name" ref={nameRef} className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="given-name" required />
          </div>
          <fieldset>
            <legend className="field-label">{t("relationLabel")}</legend>
            <div role="radiogroup" aria-label={t("relationLabel")} className="flex flex-wrap gap-2">
              {RELATIONS.map((r) => {
                const label = pick(lang, r);
                return (
                  <button type="button" role="radio" key={r[0]} aria-checked={relation === label} className="chip !min-h-[40px] !px-3 !text-[15px]" onClick={() => setRelation(relation === label ? "" : label)}>
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </>
      )}
      {mine || showNote ? (
        <div>
          <label htmlFor="g-note" className={mine ? "sr-only" : "field-label"}>
            {t(gentle ? "addTadkaGentle" : "addTadka")}
          </label>
          <textarea id="g-note" className="textarea hand !text-[19px]" rows={3} maxLength={280} dir="auto" placeholder={t("tadkaPh")} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      ) : (
        <button type="button" className="text-[15px] underline underline-offset-4 dim" onClick={() => setShowNote(true)}>
          + {t(gentle ? "addTadkaGentle" : "addTadka")}
        </button>
      )}
      <button className="btn btn-primary btn-block text-[18px]" disabled={busy || (mine && !note.trim())}>
        {busy ? <Diya size={26} /> : null}
        {mine ? t("send") : t("lightDiya")}
      </button>
      <p role="status" className="m-0 min-h-[1.4em] text-center font-medium text-[var(--turmeric)]">
        {msg}
      </p>
    </form>
  );
}

function Voice({ src, name }: { src: string; name: string }) {
  const { t } = useT();
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [missing, setMissing] = useState(false);
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  const toggle = () => {
    const a = ref.current;
    if (!a || missing) return;
    if (a.paused) void a.play().catch(() => setMissing(true));
    else a.pause();
  };

  return (
    <div className="paper flex items-center gap-4 p-4">
      <button
        onClick={toggle}
        disabled={missing}
        className="grid h-14 w-14 shrink-0 place-items-center rounded-full"
        style={{ background: "var(--saffron)", color: "#2b1205" }}
        aria-label={`${playing ? "Pause" : "Play"}: ${t("voiceOf", { name })}`}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          {playing ? <path d="M6 5h4v14H6zM14 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}
        </svg>
      </button>
      <div className="min-w-0 flex-1">
        <p className="hand m-0 text-[20px]">{t("voiceOf", { name })} 🎙</p>
        {missing ? (
          <p className="m-0 text-[13px] text-[var(--ink-dim)]">{t("voiceSample")}</p>
        ) : (
          <div className="mt-1 flex items-center gap-2 text-[12px] text-[var(--ink-dim)]">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[rgb(43_26_16/.15)]">
              <div className="h-full rounded-full bg-[var(--saffron)]" style={{ width: `${dur ? (pos / dur) * 100 : 0}%` }} />
            </div>
            <span>{mmss(dur ? dur - pos : 0)}</span>
          </div>
        )}
      </div>
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setMissing(true)}
      />
    </div>
  );
}

function OwnerTools({ slug, ownerKey, items, onChange }: { slug: string; ownerKey: string; items: Contrib[]; onChange: (f: PublicFamily) => void }) {
  const { t } = useT();
  const headers = { ...json, "x-owner-key": ownerKey };
  const refresh = () => fetch(`/api/family/${slug}`, { headers }).then((r) => r.json()).then(onChange);
  const toggle = async (c: Contrib) => {
    await fetch(`/api/family/${slug}/contrib`, { method: "PATCH", headers, body: JSON.stringify({ id: c.id, hidden: !c.hidden }) });
    await refresh();
  };
  const remove = async () => {
    if (!confirm(t("deleteConfirm"))) return;
    await fetch(`/api/family/${slug}`, { method: "DELETE", headers });
    location.href = "/";
  };
  return (
    <details className="card mt-10 p-5">
      <summary className="min-h-[32px] cursor-pointer font-semibold">{t("ownerTools")}</summary>
      <ul className="m-0 mt-4 list-none space-y-2 p-0">
        {items.map((c) => (
          <li key={c.id} className="flex items-center gap-3 text-[15px]">
            <span className="flex-1" style={{ opacity: c.hidden ? 0.5 : 1 }}>
              {c.kind === "confirm" ? "🪔" : "✍"} {c.name}
              {c.body ? `: ${c.body}` : ""} {c.hidden && <em className="muted">({t("hidden")})</em>}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => toggle(c)}>
              {c.hidden ? t("unhide") : t("hide")}
            </button>
          </li>
        ))}
      </ul>
      <button className="btn btn-sm mt-6" style={{ background: "var(--kumkum)", color: "#fff" }} onClick={remove}>
        {t("deleteFamily")}
      </button>
    </details>
  );
}
