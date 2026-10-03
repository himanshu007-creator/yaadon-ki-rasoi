import type { Metadata } from "next";
import { HistoryPage } from "@/components/HistoryPage";

export const metadata: Metadata = { title: "My memories", robots: { index: false } };

export default function Page() {
  return <HistoryPage />;
}
