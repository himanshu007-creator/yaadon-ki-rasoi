import { useId } from "react";

export function Diya({ lit = true, size = 64, label, className }: { lit?: boolean; size?: number; label?: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={className}>
      <defs>
        <radialGradient id={`h${id}`} cx="50%" cy="45%" r="50%">
          <stop offset="0" stopColor="#ffb347" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ff8a00" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`f${id}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ff7a00" />
          <stop offset="0.55" stopColor="#ffc83d" />
          <stop offset="1" stopColor="#fff6d6" />
        </linearGradient>
        <linearGradient id={`b${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c8643a" />
          <stop offset="1" stopColor="#7a2e16" />
        </linearGradient>
      </defs>
      {lit && <circle className="halo" cx="32" cy="30" r="30" fill={`url(#h${id})`} />}
      {lit ? (
        <g className="flame">
          <path d="M32 9c5 7 7.5 11.5 7.5 16a7.5 7.5 0 0 1-15 0C24.5 20.5 27 16 32 9z" fill={`url(#f${id})`} />
          <path d="M32 18c2 3 3 5 3 7a3 3 0 0 1-6 0c0-2 1-4 3-7z" fill="#fffbea" />
        </g>
      ) : (
        <path d="M32 30v-4" stroke="#8a6a50" strokeWidth="2" strokeLinecap="round" />
      )}
      <path d="M8 36c0 0 6 0 24 0s24 0 24 0c0 9-10.7 16-24 16S8 45 8 36z" fill={`url(#b${id})`} />
      <path d="M8 36c4-2.5 14-4 24-4s20 1.5 24 4" fill="none" stroke="#e08a52" strokeWidth="1.6" />
      {[16, 24, 32, 40, 48].map((x) => (
        <circle key={x} cx={x} cy="43" r="1.6" fill={lit ? "#ffc83d" : "#a8714d"} />
      ))}
    </svg>
  );
}
