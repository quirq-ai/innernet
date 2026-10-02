import type { Metadata } from "next";
import Link from "next/link";
import { AddSite } from "@/components/guide/add-site";
import { CHAPTERS } from "@/components/guide/chapters";
import { Contribute } from "@/components/guide/contribute";
import { GuideMotion } from "@/components/guide/guide-motion";
import { GuideBar, GuideRail } from "@/components/guide/guide-ruler";
import { Hero } from "@/components/guide/hero";
import { hasPlate, PLATE_IDS } from "@/components/guide/plate";
import { HowItWorks } from "@/components/guide/how-it-works";
import { Privacy } from "@/components/guide/privacy";
import { SearchPro } from "@/components/guide/search-pro";
import { SiteFooter } from "@/components/site-footer";
import { TopBar } from "@/components/top-bar";
import { getIndex } from "@/lib/data";
import { longDate, timeAgo } from "@/lib/format";
import { wikiHref } from "@/lib/links";
import "./guide.css";

// The Innernet Field Guide: how it works, how to add a site, how to search, how to
// contribute, and what stays private. Every number is read from the live index and
// every code excerpt from the code itself, so the guide never drifts from the app.

export const metadata: Metadata = {
  title: { absolute: "The Innernet Field Guide" },
  description: "How the folders on this machine become a search engine and an encyclopedia, and how to add to both.",
};

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/", label: "Search" },
  { href: "/wiki", label: "Innerpedia" },
  { href: wikiHref("Special:Random"), label: "Random article", prefetch: false },
  { href: wikiHref("Special:Statistics"), label: "Statistics" },
  { href: "#top", label: "Back to the top" },
];

export default function GuidePage() {
  return (
    <div className="fg flex min-h-dvh flex-col">
      <TopBar />
      <main id="content" tabIndex={-1} className="flex-1 focus:outline-none">
        <Hero />
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:grid lg:grid-cols-[196px_minmax(0,1fr)] lg:gap-14 xl:gap-20">
          <aside className="hidden lg:block">
            <GuideRail chapters={CHAPTERS} />
          </aside>
          <div id="guide-body" className="min-w-0 pb-8">
            <GuideBar chapters={CHAPTERS} />
            <div className="mx-auto max-w-[920px] lg:mx-0">
              <HowItWorks />
              <AddSite />
              <SearchPro />
              <Contribute />
              <Privacy />
              <Colophon />
            </div>
          </div>
        </div>
      </main>
      <SiteFooter links={LINKS} />
      <GuideMotion />
    </div>
  );
}

function Colophon() {
  const { index, missing } = getIndex();
  const drawn = PLATE_IDS.filter(hasPlate).length;
  const plates =
    drawn === PLATE_IDS.length
      ? "The plates are engraved in SVG and draw themselves once; they keep still for readers who ask for less motion."
      : drawn > 0
        ? `${drawn} of the ${PLATE_IDS.length} plates are engraved in SVG and draw themselves once, keeping still for readers who ask for less motion; the rest are still at the engraver's.`
        : "The plates are still at the engraver's; until they arrive, each frame holds a first sketch of what it will show.";
  return (
    <aside aria-label="Colophon" className="mt-32 border-t border-line-strong pt-10 text-center" data-reveal>
      <svg aria-hidden width="44" height="44" viewBox="0 0 44 44" className="mx-auto text-faint" fill="none" stroke="currentColor" strokeWidth="1">
        <circle cx="22" cy="22" r="13" />
        <circle cx="22" cy="22" r="7" />
        <path d="M2 22h40M22 2v40" />
        <circle cx="22" cy="22" r="1.6" stroke="none" style={{ fill: "var(--link)" }} />
      </svg>
      <h2 className="fg-smallcaps mt-6">Colophon</h2>
      <p className="mx-auto mt-4 max-w-[560px] font-serif text-[16px] italic leading-[1.65] text-ink-2">
        Set in Instrument Serif, Newsreader, Inter and JetBrains Mono. Every number on these pages was read from{" "}
        <span className="font-mono text-[0.85em] not-italic">data/index.json</span>
        {missing ? "" : <>, indexed {timeAgo(index.meta.generatedAt)} on {longDate(index.meta.generatedAt)}</>}, and every excerpt from the code as it stands.{" "}
        {plates}
      </p>
      <p className="mt-6 text-[13.5px]">
        <Link href="/wiki" className="link">
          Continue to Innerpedia
        </Link>
        <span aria-hidden className="px-2.5 text-faint">
          ·
        </span>
        <Link href="/" className="link">
          Search your internet
        </Link>
      </p>
    </aside>
  );
}
