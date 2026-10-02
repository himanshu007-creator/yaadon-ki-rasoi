"use client";
import { useEffect, useRef, useState } from "react";
import { fromSvg, toSvg } from "@/lib/geo";
import { stateById } from "@/lib/states";

type MapData = { viewBox: string; locations: { id: string; name: string; path: string }[] };
let cached: MapData | null = null;

// Our state ids → @svg-maps/india path ids. Its outline follows India's official boundary;
// it predates the 2019 J&K / Ladakh split, so both share the "jk" shape.
const SVG_IDS: Record<string, string[]> = {
  JK: ["jk"], LA: ["jk"], CH: ["ch"], PB: ["pb"], HP: ["hp"], UK: ["ut"], RJ: ["rj"], HR: ["hr"], DL: ["dl"], UP: ["up"],
  BR: ["br"], SK: ["sk"], AS: ["as"], AR: ["ar"], GJ: ["gj"], MP: ["mp"], CG: ["ct"], JH: ["jh"], WB: ["wb"], ML: ["ml"],
  NL: ["nl"], MN: ["mn"], DH: ["dn", "dd"], MH: ["mh"], TG: ["tg"], OD: ["or"], TR: ["tr"], MZ: ["mz"], GA: ["ga"],
  KA: ["ka"], AP: ["ap"], LD: ["ld"], KL: ["kl"], TN: ["tn"], PY: ["py"], AN: ["an"],
};
const STATE_OF = Object.fromEntries(Object.entries(SVG_IDS).flatMap(([s, ids]) => ids.map((id) => [id, s])));

export interface Lit {
  state: string;
  color: string;
  label: string;
  delay: number;
}
export interface Spot {
  lat: number;
  lng: number;
  kind: "you" | "home";
  label: string;
}

const DIYA_PATH = "M0-14c3 4 4.5 6.5 4.5 9a4.5 4.5 0 0 1-9 0c0-2.5 1.5-5 4.5-9z";

/** India on its official outline, drawn as SVG. Lazy-loads the map data (~60 KB gzipped). */
export function IndiaSvg({
  lit = [],
  spots = [],
  line,
  selected,
  playing,
  onState,
  onPick,
  label,
  className = "",
}: {
  lit?: Lit[];
  spots?: Spot[];
  line?: [Spot, Spot];
  selected?: string | null;
  playing?: string | null;
  onState?: (state: string) => void;
  onPick?: (p: { lat: number; lng: number }) => void;
  label: string;
  className?: string;
}) {
  const [data, setData] = useState<MapData | null>(cached);
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!cached) void import("@svg-maps/india").then((m) => setData((cached = m.default as MapData)));
  }, []);

  const litBy = new Map(lit.flatMap((l) => (SVG_IDS[l.state] ?? []).map((id) => [id, l] as const)));

  const pick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onPick || !svg.current) return;
    const pt = svg.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.current.getScreenCTM()!.inverse());
    onPick(fromSvg(p.x, p.y));
  };

  if (!data) return <div className={`india-svg grid aspect-[612/696] w-full place-items-center rounded-2xl ${className}`} aria-busy="true" />;

  const arc = line && (() => {
    const a = toSvg(line[0]);
    const b = toSvg(line[1]);
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    // Bow the line sideways a little so it reads as a journey, not a ruler.
    const cx = mx + ((b.y - a.y) / (d || 1)) * d * 0.18;
    const cy = my - ((b.x - a.x) / (d || 1)) * d * 0.18;
    return `M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`;
  })();

  return (
    <svg
      ref={svg}
      viewBox="-10 -10 632 716"
      role="img"
      aria-label={label}
      className={`india-svg block w-full rounded-2xl ${onPick ? "cursor-crosshair" : ""} ${className}`}
      onClick={pick}
    >
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {data.locations.map((loc) => {
        const l = litBy.get(loc.id);
        const st = STATE_OF[loc.id];
        const isSel = st && (st === selected || st === playing);
        return (
          <path
            key={loc.id}
            d={loc.path}
            className={l ? "state lit" : "state"}
            style={l ? ({ "--c": l.color, animationDelay: `${l.delay}ms` } as React.CSSProperties) : undefined}
            strokeWidth={isSel ? 2.2 : 0.7}
            stroke={isSel ? "#fff6d6" : undefined}
            onClick={l && onState ? (e) => (e.stopPropagation(), onState(st)) : undefined}
          >
            <title>{l ? `${loc.name}: ${l.label}` : loc.name}</title>
          </path>
        );
      })}
      {lit.map((l) => {
        const st = stateById(l.state);
        if (!st || l.state === "LA") return null;
        const { x, y } = toSvg(st);
        const on = l.state === playing;
        return (
          // SVG transform attributes live on outer groups; CSS animations (which override `transform`) on inner ones.
          <g key={l.state} transform={`translate(${x} ${y})`} pointerEvents="none">
            <g className="state-diya" style={{ animationDelay: `${l.delay + 200}ms` }}>
              {on && <circle r="22" fill={l.color} opacity=".35" className="speaking" />}
              <circle r="9" fill={l.color} opacity=".35" filter="url(#glow)" />
              <g transform="scale(.9)">
                <path d={DIYA_PATH} fill="#ffc83d" className="flame" />
              </g>
              <path d="M-8 1h16c0 3.5-3.6 6-8 6s-8-2.5-8-6z" fill={l.color} />
            </g>
          </g>
        );
      })}
      {arc && <path d={arc} className="doori-arc" fill="none" />}
      {spots.map((s) => {
        const { x, y } = toSvg(s);
        return s.kind === "you" ? (
          <g key="you" transform={`translate(${x} ${y})`} pointerEvents="none">
            <circle r="14" className="you-pulse" />
            <circle r="5.5" fill="#7cc4ff" stroke="#fff" strokeWidth="2" />
            <text y="22" textAnchor="middle" className="spot-label you">{s.label}</text>
          </g>
        ) : (
          <g key="home" transform={`translate(${x} ${y})`} pointerEvents="none">
            <circle r="16" fill="#f77f00" opacity=".3" filter="url(#glow)" />
            <g transform="translate(0 -2) scale(1.4)">
              <path d={DIYA_PATH} fill="#ffc83d" className="flame" />
            </g>
            <path d="M-11 1h22c0 5-5 8-11 8s-11-3-11-8z" fill="#f77f00" />
            <text y="-24" textAnchor="middle" className="spot-label home">{s.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
