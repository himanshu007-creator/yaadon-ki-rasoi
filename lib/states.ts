// 36 states/UTs with an approximate centre point for map markers.
export interface StateTile {
  id: string; // short canonical id, e.g. "MH"
  name: string;
  lat: number;
  lng: number;
  codes: string[]; // every ISO 3166-2:IN spelling seen in the wild
}

export const STATES: StateTile[] = [
  { id: "JK", name: "Jammu and Kashmir", lat: 33.7, lng: 75.0, codes: ["IN-JK"] },
  { id: "LA", name: "Ladakh", lat: 34.2, lng: 77.6, codes: ["IN-LA"] },
  { id: "CH", name: "Chandigarh", lat: 30.73, lng: 76.78, codes: ["IN-CH"] },
  { id: "PB", name: "Punjab", lat: 30.9, lng: 75.4, codes: ["IN-PB"] },
  { id: "HP", name: "Himachal Pradesh", lat: 31.9, lng: 77.2, codes: ["IN-HP"] },
  { id: "UK", name: "Uttarakhand", lat: 30.1, lng: 79.0, codes: ["IN-UK", "IN-UT"] },
  { id: "RJ", name: "Rajasthan", lat: 26.6, lng: 73.8, codes: ["IN-RJ"] },
  { id: "HR", name: "Haryana", lat: 29.1, lng: 76.1, codes: ["IN-HR"] },
  { id: "DL", name: "Delhi", lat: 28.65, lng: 77.15, codes: ["IN-DL"] },
  { id: "UP", name: "Uttar Pradesh", lat: 27.0, lng: 80.9, codes: ["IN-UP"] },
  { id: "BR", name: "Bihar", lat: 25.8, lng: 85.6, codes: ["IN-BR"] },
  { id: "SK", name: "Sikkim", lat: 27.5, lng: 88.5, codes: ["IN-SK"] },
  { id: "AS", name: "Assam", lat: 26.2, lng: 92.8, codes: ["IN-AS"] },
  { id: "AR", name: "Arunachal Pradesh", lat: 28.0, lng: 94.6, codes: ["IN-AR"] },
  { id: "GJ", name: "Gujarat", lat: 22.6, lng: 71.6, codes: ["IN-GJ"] },
  { id: "MP", name: "Madhya Pradesh", lat: 23.5, lng: 78.3, codes: ["IN-MP"] },
  { id: "CG", name: "Chhattisgarh", lat: 21.3, lng: 81.9, codes: ["IN-CG", "IN-CT"] },
  { id: "JH", name: "Jharkhand", lat: 23.6, lng: 85.3, codes: ["IN-JH"] },
  { id: "WB", name: "West Bengal", lat: 23.0, lng: 87.9, codes: ["IN-WB"] },
  { id: "ML", name: "Meghalaya", lat: 25.5, lng: 91.3, codes: ["IN-ML"] },
  { id: "NL", name: "Nagaland", lat: 26.1, lng: 94.5, codes: ["IN-NL"] },
  { id: "MN", name: "Manipur", lat: 24.7, lng: 93.9, codes: ["IN-MN"] },
  { id: "DH", name: "Dadra and Nagar Haveli and Daman and Diu", lat: 20.4, lng: 72.9, codes: ["IN-DH", "IN-DN", "IN-DD"] },
  { id: "MH", name: "Maharashtra", lat: 19.5, lng: 75.7, codes: ["IN-MH"] },
  { id: "TG", name: "Telangana", lat: 17.9, lng: 79.1, codes: ["IN-TG", "IN-TS"] },
  { id: "OD", name: "Odisha", lat: 20.5, lng: 84.4, codes: ["IN-OD", "IN-OR"] },
  { id: "TR", name: "Tripura", lat: 23.8, lng: 91.6, codes: ["IN-TR"] },
  { id: "MZ", name: "Mizoram", lat: 23.4, lng: 92.8, codes: ["IN-MZ"] },
  { id: "GA", name: "Goa", lat: 15.35, lng: 74.05, codes: ["IN-GA"] },
  { id: "KA", name: "Karnataka", lat: 14.8, lng: 75.8, codes: ["IN-KA"] },
  { id: "AP", name: "Andhra Pradesh", lat: 15.9, lng: 79.7, codes: ["IN-AP"] },
  { id: "LD", name: "Lakshadweep", lat: 10.6, lng: 72.6, codes: ["IN-LD"] },
  { id: "KL", name: "Kerala", lat: 10.4, lng: 76.4, codes: ["IN-KL"] },
  { id: "TN", name: "Tamil Nadu", lat: 11.1, lng: 78.4, codes: ["IN-TN"] },
  { id: "PY", name: "Puducherry", lat: 11.94, lng: 79.81, codes: ["IN-PY"] },
  { id: "AN", name: "Andaman and Nicobar Islands", lat: 11.7, lng: 92.7, codes: ["IN-AN"] },
];

const norm = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z]/g, "");
const byCode = new Map(STATES.flatMap((s) => s.codes.map((c) => [c, s] as const)));
const byName = new Map(STATES.map((s) => [norm(s.name), s]));
// Older / alternate spellings Trends and users still use.
for (const [alias, id] of [
  ["orissa", "OD"], ["nctofdelhi", "DL"], ["newdelhi", "DL"], ["pondicherry", "PY"],
  ["uttaranchal", "UK"], ["jammuandkashmirandladakh", "JK"], ["andamanandnicobar", "AN"],
  ["dadraandnagarhaveli", "DH"], ["damananddiu", "DH"],
] as const) byName.set(alias, STATES.find((s) => s.id === id)!);

/** Map a Trends row (geo code and/or location name) to a tile. Tolerates IN-OR/IN-OD etc. */
export function findState(geo?: string, location?: string): StateTile | undefined {
  return (geo && byCode.get(geo.toUpperCase())) || (location ? byName.get(norm(location)) : undefined);
}

export const stateById = (id?: string) => STATES.find((s) => s.id === id);
