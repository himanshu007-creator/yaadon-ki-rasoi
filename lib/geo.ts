export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (x: number) => (x * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Calibrated against @svg-maps/india (viewBox 0 0 612 696): x is linear in longitude, y is Mercator.
const LNG0 = 68.16;
const X_PER_DEG = 611.9 / (97.41 - 68.16);
const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const M_TOP = merc(37.08);
const M_SPAN = M_TOP - merc(8.08);
const Y_SPAN = 667.8;

export const toSvg = (p: { lat: number; lng: number }) => ({ x: (p.lng - LNG0) * X_PER_DEG, y: ((M_TOP - merc(p.lat)) / M_SPAN) * Y_SPAN });

export function fromSvg(x: number, y: number) {
  const m = M_TOP - (y / Y_SPAN) * M_SPAN;
  return { lat: ((2 * Math.atan(Math.exp(m)) - Math.PI / 2) * 180) / Math.PI, lng: x / X_PER_DEG + LNG0 };
}
