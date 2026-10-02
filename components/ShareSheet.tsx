"use client";
import { useEffect, useRef, useState } from "react";
import { download, intentUrl, trackShare, withUtm, type Channel } from "@/lib/share";
import { useT } from "./Lang";
import { RecipeSheet, ShareCard, type CardData } from "./ShareCard";

const CHANNELS: { id: Channel; label: string; color: string; icon: string }[] = [
  { id: "whatsapp", label: "WhatsApp", color: "#25d366", icon: "M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z" },
  { id: "instagram", label: "Instagram", color: "#e1306c", icon: "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm6-1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" },
  { id: "reddit", label: "Reddit", color: "#ff4500", icon: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm4.5 9.5c-.8 1.3-2.6 2-4.5 2s-3.7-.7-4.5-2m1.5-3a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm6 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" },
  { id: "linkedin", label: "LinkedIn", color: "#0a66c2", icon: "M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm3 7v8m0-11v.01M11 18v-5a2 2 0 0 1 4 0v5m-4-8v8" },
  { id: "x", label: "X", color: "#e7e7e7", icon: "M4 4l16 16M20 4L4 20" },
  { id: "facebook", label: "Facebook", color: "#1877f2", icon: "M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v7h4v-7h3l1-4h-4V8z" },
  { id: "telegram", label: "Telegram", color: "#29a9eb", icon: "M21 4L3 11l6 2 2 6 3-4 5 4 2-15zM9 13l9-6" },
  { id: "email", label: "Email", color: "#ffc83d", icon: "M3 6h18v12H3zM3 6l9 7 9-7" },
];

/**
 * Downloads (PNG card, PDF) work even when a link can't travel; social buttons carry UTM-tagged links.
 * modern-screenshot and jsPDF load only when someone taps download.
 */
export function ShareSheet({ card, path, content, text, title }: { card: CardData; path: string; content: "family" | "result"; text: string; title: string }) {
  const { t } = useT();
  const cardRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<"" | "image" | "pdf">("");
  const [note, setNote] = useState("");
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare("share" in navigator), []);
  const slug = card.dish.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const png = async (el: HTMLElement, type = "image/png") => {
    const { domToBlob } = await import("modern-screenshot");
    await document.fonts.ready;
    return domToBlob(el, { scale: 2, type, quality: 0.88, backgroundColor: el.classList.contains("paper") ? "#fff4de" : "#120a06", timeout: 15_000 });
  };

  const saveImage = async () => {
    setBusy("image");
    try {
      download(await png(cardRef.current!), `yaadon-ki-rasoi-${slug}.png`);
      trackShare("image", content);
      setNote(t("downloaded"));
    } catch {
      setNote(t("error"));
    }
    setBusy("");
  };

  const savePdf = async () => {
    setBusy("pdf");
    try {
      // JPEG pages keep the PDF small enough for WhatsApp (PNG made it ~10 MB).
      const [{ jsPDF }, cardPng, sheetPng] = await Promise.all([import("jspdf"), png(cardRef.current!, "image/jpeg"), png(sheetRef.current!, "image/jpeg")]);
      const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
      const url = withUtm(path, "pdf", content);
      const add = async (blob: Blob, maxW: number) => {
        const data = await new Promise<string>((r) => {
          const fr = new FileReader();
          fr.onload = () => r(fr.result as string);
          fr.readAsDataURL(blob);
        });
        const img = await new Promise<HTMLImageElement>((r) => {
          const i = new Image();
          i.onload = () => r(i);
          i.src = data;
        });
        const w = Math.min(maxW, (270 * img.width) / img.height);
        pdf.addImage(data, "JPEG", (210 - w) / 2, 12, w, (w * img.height) / img.width);
      };
      pdf.setFillColor(18, 10, 6);
      pdf.rect(0, 0, 210, 297, "F");
      await add(cardPng, 190);
      pdf.setTextColor(255, 159, 28);
      pdf.textWithLink(url.replace(/\?.*$/, ""), 105, 290, { url, align: "center" });
      pdf.addPage();
      await add(sheetPng, 190);
      pdf.save(`yaadon-ki-rasoi-${slug}.pdf`);
      trackShare("pdf", content);
      setNote(t("downloaded"));
    } catch {
      setNote(t("error"));
    }
    setBusy("");
  };

  const share = async (c: Channel) => {
    trackShare(c, content);
    const url = withUtm(path, c, content);
    if (c === "instagram") {
      // No web share URL exists for Instagram: hand the card image to the OS share sheet, or save it + copy the caption.
      setBusy("image");
      try {
        const file = new File([await png(cardRef.current!)], `yaadon-ki-rasoi-${slug}.png`, { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: `${text} ${url}` });
        else {
          download(file, file.name);
          await navigator.clipboard?.writeText(`${text} ${url}`).catch(() => {});
          setNote(t("igHint"));
        }
      } catch {}
      setBusy("");
      return;
    }
    window.open(intentUrl(c, url, text, title), "_blank", "noopener,noreferrer");
  };

  const copy = async () => {
    trackShare("copy", content);
    await navigator.clipboard?.writeText(withUtm(path, "copy", content)).catch(() => {});
    setNote(t("copied"));
  };

  const native = async () => {
    trackShare("native", content);
    await navigator.share?.({ title, text, url: withUtm(path, "native", content) }).catch(() => {});
  };

  return (
    <div className="grid items-start gap-6 md:grid-cols-[auto_1fr]">
      <div className="mx-auto overflow-hidden rounded-[18px] shadow-[0_24px_60px_-20px_rgb(0_0_0/.8)]" style={{ width: 540 * 0.56, height: 675 * 0.56 }}>
        <div style={{ transform: "scale(.56)", transformOrigin: "top left" }}>
          <ShareCard d={card} />
        </div>
      </div>
      {/* Export copies: untransformed, off-screen, so captures are exactly 1080×1350 / A4 width. */}
      <div aria-hidden className="pointer-events-none fixed left-[-10000px] top-0 flex flex-col gap-4">
        <ShareCard ref={cardRef} d={card} />
        <RecipeSheet ref={sheetRef} d={card} />
      </div>

      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={saveImage} disabled={!!busy}>
            ⬇ {busy === "image" ? t("preparing") : t("dlImage")}
          </button>
          <button className="btn btn-ghost" onClick={savePdf} disabled={!!busy}>
            📄 {busy === "pdf" ? t("preparing") : t("dlPdf")}
          </button>
        </div>
        <div>
          <p className="muted mb-2 text-[14px]">{t("shareOn")}</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {CHANNELS.map((c) => (
              <button key={c.id} className="share-chip" onClick={() => share(c.id)} disabled={busy !== "" && c.id === "instagram"} aria-label={`${t("shareOn")} ${c.label}`}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={c.icon} />
                </svg>
                <span>{c.label}</span>
              </button>
            ))}
            <button className="share-chip" onClick={copy}>
              <span aria-hidden className="text-[18px]">🔗</span>
              <span>{t("copyLink")}</span>
            </button>
            {canShare && (
              <button className="share-chip" onClick={native}>
                <span aria-hidden className="text-[18px]">⋯</span>
                <span>{t("moreApps")}</span>
              </button>
            )}
          </div>
        </div>
        <p role="status" className="m-0 min-h-[1.4em] text-[14px] font-medium text-[var(--turmeric)]">
          {note}
        </p>
      </div>
    </div>
  );
}
