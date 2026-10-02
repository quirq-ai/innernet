import type { Metadata } from "next";
import { ExampleQueries } from "@/components/home/example-queries";
import { HeroSearch } from "@/components/home/hero-search";
import { HomeFooter } from "@/components/home/home-footer";
import { MissingIndex } from "@/components/home/missing-index";
import { RecentlyTouched, recentlyTouched } from "@/components/home/recently-touched";
import { getSearchBoxProps } from "@/components/search/search-config";
import { Wordmark } from "@/components/wordmark";
import Link from "next/link";
import { getIndex } from "@/lib/data";
import { num } from "@/lib/format";
import { searchHref, wikiHref } from "@/lib/links";
import { getUiConfig, uiText } from "@/lib/ui-config";

export function generateMetadata(): Metadata {
  const config = getUiConfig();
  return {
    title: { absolute: uiText("home.title", { tagline: config.brand.tagline }, config) },
    description: config.brand.description,
  };
}

// Counts and "indexed N ago" are live, so render on every request.
export const dynamic = "force-dynamic";

// The shared .aurora mask is sized in percent, so on wide screens it washes the whole
// page. Here it is a fixed-size pool of light behind the wordmark and the box, and the
// paper shows around it at every width.
const AURORA_MASK = "radial-gradient(ellipse min(580px, 100vw) min(440px, 56vh) at 50% 38%, #000 22%, transparent 100%)";
const auroraStyle = { maskImage: AURORA_MASK, WebkitMaskImage: AURORA_MASK };

export default function Home() {
  const config = getUiConfig();
  const { home } = config;
  const { index, articles, missing } = getIndex();
  const { counts } = index.meta;
  const recent = missing || !home.showRecent ? [] : recentlyTouched(articles, home.recentLimit);

  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-x-clip">
      <div className="aurora" aria-hidden style={auroraStyle}>
        <span />
        <span />
        <span />
      </div>

      <main className="relative flex flex-1 flex-col">
        <section className="flex flex-1 flex-col items-center justify-center px-4 pb-[8vh] pt-[14vh] sm:pt-[12vh]">
          <h1 className="rise max-w-full text-center font-display text-[64px] leading-[0.95] tracking-[-0.02em] text-ink [overflow-wrap:anywhere] sm:text-[96px]">
            <Wordmark href={null} size={null} />
          </h1>

          <p className="rise mt-4 max-w-full text-center text-[15px] text-muted [overflow-wrap:anywhere] sm:mt-5" style={{ animationDelay: "60ms" }}>
            {missing ? (
              uiText("home.waitingTagline", { tagline: config.brand.tagline }, config)
            ) : (
              <>
                <span className="block sm:inline">{config.brand.tagline}</span>
                {home.showCounts && (
                  <>
                    <Count n={counts.pages} label={uiText("home.folders", undefined, config)} href={wikiHref("Special:Statistics")} first />
                    <Count n={counts.articles} label={uiText("home.articles", undefined, config)} href={wikiHref("Special:AllPages")} />
                    <Count n={counts.repos} label={uiText("home.repositories", undefined, config)} href={searchHref("kind:repo")} className="hidden sm:inline" />
                  </>
                )}
              </>
            )}
          </p>

          <div className="mt-9 flex w-full flex-col items-center sm:mt-10">
            {missing ? (
              <MissingIndex />
            ) : (
              <>
                <HeroSearch
                  searchBox={{ ...getSearchBoxProps(config), placeholder: uiText("home.searchPlaceholder", undefined, config), autoFocus: home.autoFocus }}
                  searchLabel={uiText("home.searchButton", undefined, config)}
                  curiousLabel={uiText("home.curiousButton", undefined, config)}
                  showCurious={home.showCurious}
                />
                {home.showExamples && (
                  <div className="rise mt-6" style={{ animationDelay: "240ms" }}>
                    <ExampleQueries />
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <RecentlyTouched pages={recent} delay={300} />
      </main>

      <HomeFooter meta={index.meta} missing={missing} />
    </div>
  );
}

/**
 * " · 958 articles". Like the article count on Wikipedia's front page, each count is a
 * quiet link to where those things are listed. On phones the line breaks before the
 * first count, so that middot hides.
 */
function Count({ n, label, href, first = false, className = "" }: { n: number; label: string; href: string; first?: boolean; className?: string }) {
  return (
    <span className={className}>
      <span aria-hidden className={`mx-2 text-faint ${first ? "hidden sm:inline" : ""}`}>
        ·
      </span>
      <Link
        href={href}
        className="group decoration-line-strong underline-offset-[5px] transition-colors hover:text-ink hover:underline"
      >
        <span className="tabular-nums text-ink-2 transition-colors group-hover:text-ink">{num(n)}</span> {label}
      </Link>
    </span>
  );
}
