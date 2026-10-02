"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { MemoryInput } from "@/lib/types";
import { Diya } from "./Diya";
import { Investigation, type Flagship } from "./Investigation";
import { useT } from "./Lang";

export function SearchPage({ flagships }: { flagships: Flagship[] }) {
  const { t } = useT();
  const [input, setInput] = useState<MemoryInput | null | undefined>(undefined);
  useEffect(() => {
    try {
      setInput(JSON.parse(sessionStorage.getItem("yr-search") ?? "null"));
    } catch {
      setInput(null);
    }
  }, []);
  if (input === undefined) return null;
  if (!input)
    return (
      <main className="wrap narrow grid min-h-[80dvh] place-items-center text-center">
        <div className="space-y-6">
          <Diya size={80} lit={false} />
          <h1 className="text-[30px]">{t("invGone")}</h1>
          <Link href="/#describe" className="btn btn-primary">
            {t("tryAgain")}
          </Link>
        </div>
      </main>
    );
  return <Investigation input={input} flagships={flagships} />;
}
