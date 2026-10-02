export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export const tokens = (s: string) => new Set(norm(s).split(" ").filter(Boolean));

/** Token-set ratio in [0,1]: how much of the shorter phrase's tokens appear in the longer text. */
export function tokenSetRatio(phrase: string, text: string) {
  const a = tokens(phrase);
  if (!a.size) return 0;
  const b = tokens(text);
  let hit = 0;
  for (const t of a) if (b.has(t)) hit++;
  return hit / a.size;
}

export function hasPhrase(text: string, phrase: string) {
  const p = norm(phrase);
  return !!p && ` ${norm(text)} `.includes(` ${p} `);
}

export const domainOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

export const slugify = (s: string) => norm(s).replace(/ /g, "-").slice(0, 40);

export const titleCase = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
