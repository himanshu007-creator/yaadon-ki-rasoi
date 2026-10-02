"use client";
import { useEffect, useRef, useState } from "react";
import { PLACES } from "@/lib/places";
import { STATES } from "@/lib/states";
import type { City } from "@/lib/types";
import { IndiaSvg } from "./IndiaSvg";
import { useT } from "./Lang";

const LOCAL: City[] = [...PLACES, ...STATES.map((s) => ({ name: s.name, lat: s.lat, lng: s.lng, state: s.id }))];
const inIndia = (lat: number, lng: number) => lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98;

async function geocode(params: string): Promise<City[]> {
  try {
    const r = await fetch(`/api/geocode?${params}`);
    return r.ok ? (await r.json()).results : [];
  } catch {
    return [];
  }
}

/**
 * Any place in India: instant matches from our list, then villages/towns from OpenStreetMap.
 * `locate` adds precise GPS ("you"); `mapPick` lets people tap the map ("Nani's ghar" can be anywhere).
 */
export function PlacePicker({ id, value, onChange, describedBy, locate, mapPick, placeholder }: { id: string; value: City | null; onChange: (c: City | null) => void; describedBy?: string; locate?: boolean; mapPick?: boolean; placeholder?: string }) {
  const { t } = useT();
  const [text, setText] = useState(value?.name ?? "");
  const [remote, setRemote] = useState<City[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState<"" | "gps" | "search" | "map">("");
  const [note, setNote] = useState("");
  const [showMap, setShowMap] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => setText(value?.name ?? ""), [value?.name]);

  const q = text.trim().toLowerCase();
  const local = q.length < 2 ? [] : LOCAL.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 5);
  const options = [...local, ...remote.filter((r) => !local.some((l) => l.name === r.name))].slice(0, 8);

  const type = (v: string) => {
    setText(v);
    setOpen(true);
    setActive(0);
    setNote("");
    clearTimeout(timer.current);
    if (v.trim().length < 3) return setRemote([]);
    timer.current = setTimeout(async () => {
      setBusy("search");
      setRemote(await geocode(`q=${encodeURIComponent(v.trim())}`));
      setBusy("");
    }, 450);
  };

  const choose = (c: City) => {
    onChange(c);
    setText(c.name);
    setOpen(false);
    setShowMap(false);
  };

  const gps = () => {
    setBusy("gps");
    setNote("");
    navigator.geolocation?.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lng, accuracy } }) => {
        if (!inIndia(lat, lng)) return setBusy(""), setNote(t("locationDenied"));
        const [hit] = await geocode(`lat=${lat}&lng=${lng}`);
        setBusy("");
        setNote(t("accuracy", { m: Math.round(accuracy) }));
        choose({ name: hit?.name ?? t("myLocation"), lat, lng, state: hit?.state });
      },
      () => (setBusy(""), setNote(t("locationDenied"))),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  };

  const pickOnMap = async (p: { lat: number; lng: number }) => {
    setBusy("map");
    const [hit] = await geocode(`lat=${p.lat}&lng=${p.lng}`);
    setBusy("");
    choose({ name: hit?.name ?? t("pickedOnMap"), ...p, state: hit?.state });
  };

  const listId = `${id}-list`;
  return (
    <div className="relative">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          className="input"
          role="combobox"
          aria-expanded={open && options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? `${id}-opt-${active}` : undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          placeholder={placeholder}
          value={text}
          onChange={(e) => type(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(a + 1, options.length - 1)));
            if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
            if (e.key === "Enter" && open && options[active]) (e.preventDefault(), choose(options[active]));
            if (e.key === "Escape") setOpen(false);
          }}
        />
        {locate && (
          <button type="button" className="btn btn-ghost shrink-0" onClick={gps} disabled={busy === "gps"}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
            </svg>
            {busy === "gps" ? t("locating") : t("useLocation")}
          </button>
        )}
        {mapPick && (
          <button type="button" className="btn btn-ghost shrink-0" aria-expanded={showMap} onClick={() => setShowMap((s) => !s)}>
            🗺 {t("pickOnMap")}
          </button>
        )}
      </div>

      {open && (options.length > 0 || busy === "search") && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-72 w-full list-none overflow-auto rounded-2xl border border-[var(--line)] p-1 shadow-xl" style={{ background: "var(--surface-2)" }}>
          {options.map((o, i) => (
            <li
              key={`${o.name}-${o.lat}`}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className="cursor-pointer rounded-xl px-3 py-2.5 text-[16px]"
              style={i === active ? { background: "rgb(255 159 28 / .18)" } : undefined}
              onMouseDown={(e) => (e.preventDefault(), choose(o))}
              onMouseEnter={() => setActive(i)}
            >
              📍 {o.name}
            </li>
          ))}
          {busy === "search" && <li className="muted px-3 py-2 text-[14px]">{t("searchingPlaces")}</li>}
        </ul>
      )}

      {showMap && (
        <div className="mt-3 space-y-2">
          <p className="muted m-0 text-[14px]">{busy === "map" ? t("locating") : t("tapMapHint")}</p>
          <IndiaSvg onPick={pickOnMap} spots={value ? [{ ...value, kind: "home", label: "" }] : []} label={t("pickOnMap")} className="mx-auto max-w-[380px]" />
        </div>
      )}
      {note && <p className="muted mt-2 text-[13px]">{note}</p>}
      {(remote.length > 0 || showMap) && <p className="muted mt-1 text-[11px]">{t("osmCredit")}</p>}
    </div>
  );
}
