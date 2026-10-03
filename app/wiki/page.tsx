import type { Metadata } from "next";
import { WikiShell } from "@/components/wiki/wiki-shell";
import { BrowseByCategory, OtherAreas } from "@/components/wiki/main/browse";
import { DidYouKnow } from "@/components/wiki/main/did-you-know";
import { FeaturedArticle } from "@/components/wiki/main/featured";
import { InTheNews } from "@/components/wiki/main/in-the-news";
import { OnThisDay } from "@/components/wiki/main/on-this-day";
import { Welcome } from "@/components/wiki/main/welcome";
import { getIndex } from "@/lib/data";
import { INDEX_COMMAND } from "@/lib/mode";
import { getUiConfig, uiText } from "@/lib/ui-config";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return { title: uiText("wiki.mainTitle") };
}

export default function WikiMain() {
  const config = getUiConfig();
  if (getIndex().missing) {
    return (
      <WikiShell>
        <main className="mx-auto max-w-[640px] py-20 text-center">
          <h1 className="font-display text-[48px] leading-tight [overflow-wrap:anywhere]">{uiText("wiki.missingTitle")}</h1>
          <p className="mt-4 font-serif text-[18px] text-ink-2">{uiText("wiki.missingDescription", { indexCommand: INDEX_COMMAND })}</p>
        </main>
      </WikiShell>
    );
  }

  const sections = {
    welcome: <Welcome />,
    featured: <FeaturedArticle delay={60} />,
    news: <InTheNews delay={100} />,
    "did-you-know": <DidYouKnow delay={180} />,
    "on-this-day": <OnThisDay delay={140} />,
    browse: <BrowseByCategory delay={220} />,
    areas: <OtherAreas delay={260} />,
  };
  const wide = new Set(["welcome", "browse", "areas"]);

  return (
    <WikiShell>
      <main className="grid gap-12 sm:gap-y-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-x-14">
        {config.wiki.mainSections.map((id) => (
          <div key={id} className={`min-w-0 ${wide.has(id) ? "lg:col-span-2" : ""}`}>{sections[id]}</div>
        ))}
      </main>
    </WikiShell>
  );
}
