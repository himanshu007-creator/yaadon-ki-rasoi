import { SearchPage } from "@/components/SearchPage";
import { library } from "@/lib/library";

export default function Page() {
  return <SearchPage flagships={library().map((e) => ({ name: e.name, text: e.seed.text }))} />;
}
