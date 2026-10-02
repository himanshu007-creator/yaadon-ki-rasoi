import { ImageResponse } from "next/og";

export const alt = "Yaadon Ki Rasoi — Shazam for the taste of your childhood";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Static: generated once at build. Romanised text + drawn diya art only, never scraped photos.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 64, padding: 80, background: "radial-gradient(circle at 25% 45%, #3a1c0b, #120a06 60%)", color: "#fff4de" }}>
        <svg width="300" height="300" viewBox="0 0 64 64">
          <circle cx="32" cy="30" r="30" fill="#ff9f1c" fillOpacity="0.25" />
          <path d="M32 9c5 7 7.5 11.5 7.5 16a7.5 7.5 0 0 1-15 0C24.5 20.5 27 16 32 9z" fill="#ffc83d" />
          <path d="M32 18c2 3 3 5 3 7a3 3 0 0 1-6 0c0-2 1-4 3-7z" fill="#fffbea" />
          <path d="M8 36h48c0 9-10.7 16-24 16S8 45 8 36z" fill="#a8482a" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 700, color: "#ffc83d" }}>Yaadon Ki Rasoi</div>
          <div style={{ fontSize: 40 }}>Humne woh swaad dhoondh liya 🪔</div>
          <div style={{ fontSize: 32, color: "#e9d3ad" }}>Tum bhi apni yaad jodo — ek diya jalao.</div>
        </div>
      </div>
    ),
    size,
  );
}
