"use client";
import { track } from "@vercel/analytics";

export type Channel = "whatsapp" | "instagram" | "reddit" | "linkedin" | "x" | "facebook" | "telegram" | "email" | "copy" | "native" | "image" | "pdf";

const CAMPAIGN = "diwali2026";

/** Absolute URL tagged so Vercel Analytics can tell which share brought people in. */
export function withUtm(path: string, source: Channel, content: "family" | "result") {
  const u = new URL(path, location.origin);
  u.searchParams.set("utm_source", source);
  u.searchParams.set("utm_medium", source === "email" ? "email" : "social");
  u.searchParams.set("utm_campaign", CAMPAIGN);
  u.searchParams.set("utm_content", content);
  return u.toString();
}

/** Share-intent URLs; each opens the network's own composer. */
export function intentUrl(channel: Channel, url: string, text: string, title: string) {
  const e = encodeURIComponent;
  switch (channel) {
    case "whatsapp":
      return `https://wa.me/?text=${e(`${text} ${url}`)}`;
    case "reddit":
      return `https://www.reddit.com/submit?url=${e(url)}&title=${e(title)}`;
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${e(url)}`;
    case "x":
      return `https://twitter.com/intent/tweet?text=${e(text)}&url=${e(url)}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${e(url)}`;
    case "telegram":
      return `https://t.me/share/url?url=${e(url)}&text=${e(text)}`;
    case "email":
      return `mailto:?subject=${e(title)}&body=${e(`${text}\n\n${url}`)}`;
    default:
      return url;
  }
}

export const trackShare = (channel: Channel, content: string) => {
  try {
    track("share", { channel, content });
  } catch {}
};

export function download(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
