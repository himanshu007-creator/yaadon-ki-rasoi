import type { Metadata } from "next";
import Link from "next/link";
import { Diya } from "@/components/Diya";
import { Family } from "@/components/Family";
import { MAKER_LABEL, t } from "@/lib/copy";
import { serverLang } from "@/lib/http";
import { getFamily, publicView } from "@/lib/store";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const f = await getFamily((await params).slug);
  if (!f) return { title: "Yeh diya bujh gaya hai", robots: { index: false } };
  const title = t("hinglish", "famHeading", { owner: f.ownerName, maker: MAKER_LABEL[f.maker ?? "other"][0], dish: f.dish.name });
  return { title, description: t("hinglish", "familyBody"), robots: { index: false } };
}

export default async function Page({ params }: Props) {
  const f = await getFamily((await params).slug);
  const lang = await serverLang();
  if (!f)
    return (
      <main className="wrap narrow grid min-h-[80dvh] place-items-center text-center">
        <div className="space-y-5">
          <Diya size={88} lit={false} />
          <h1 className="text-[34px]">{t(lang, "gone")}</h1>
          <p className="dim">{t(lang, "goneHelp")}</p>
          <Link href="/" className="btn btn-primary">
            {t(lang, "findYours")}
          </Link>
        </div>
      </main>
    );
  return <Family initial={publicView(f)} />;
}
