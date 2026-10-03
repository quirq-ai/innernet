import type { Metadata } from "next";
import { ExampleQueries } from "@/components/home/example-queries";
import { HeroSearch } from "@/components/home/hero-search";
import { HomeFooter } from "@/components/home/home-footer";
import { MissingIndex } from "@/components/home/missing-index";
import { RecentlyTouched, recentlyTouched } from "@/components/home/recently-touched";
import { getSearchBoxProps } from "@/components/search/search-config";
import { Wordmark } from "@/components/wordmark";
import { BrandHome, BrandLinks } from "@/components/brand-nav";
import Link from "next/link";
import { getIndex } from "@/lib/data";
import { num } from "@/lib/format";
import { searchHref, wikiHref } from "@/lib/links";
import { getUiConfig, uiText } from "@/lib/ui-config";
import { DEMO, DEMO_ORG } from "@/lib/mode";
import { getNavigation } from "@/lib/ui-navigation";

export function generateMetadata(): Metadata {
  const config = getUiConfig();
  return {
    title: { absolute: uiText(DEMO ? "demo.homeTitle" : "home.title", { tagline: config.brand.tagline, org: DEMO_ORG }, config) },
    description: DEMO ? uiText("demo.homeDescription", { org: DEMO_ORG }, config) : config.brand.description,
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
  const centered = home.layout === "centered";
  const recent = missing || !home.showRecent ? [] : recentlyTouched(articles, home.recentLimit);
  const headerLinks = getNavigation("home");

  return (
    <div data-home-layout={home.layout} className="ui-home relative isolate flex min-h-[calc(100dvh-var(--demo-bar,0px))] flex-col overflow-x-clip">
      <div className="aurora" aria-hidden style={auroraStyle}>
        <span />
        <span />
        <span />
      </div>

      <header className="ui-home-header relative z-10 mx-auto flex w-full max-w-[var(--ui-max-width)] items-center justify-between gap-3 px-4 pt-5 sm:px-6">
        <div className="shrink-0"><BrandHome size={30} /></div>
        <div className="flex min-w-0 items-center gap-1 text-[13.5px]">
          <nav aria-label={uiText("siteNavigation", {}, config)} className="hidden max-w-[40vw] items-center overflow-x-auto whitespace-nowrap sm:flex">
            {headerLinks.filter((link) => link.href !== "/guide").map((link) => <Link key={link.href} href={link.href} prefetch={link.prefetch} className="block rounded-full px-3 py-1.5 text-muted transition-colors hover:bg-bg-sunk hover:text-ink">{link.label}</Link>)}
          </nav>
          <BrandLinks guide={headerLinks.some((link) => link.href === "/guide")} />
        </div>
      </header>

      <main className={`ui-home-main relative flex-1 ${centered ? "flex flex-col" : ""}`}>
        <section data-home-hero className={`ui-home-hero ${centered ? "flex flex-1 flex-col items-center justify-center px-4 pb-[8vh] pt-[14vh] sm:pt-[12vh]" : ""}`}>
          {!centered && <p className="ui-home-eyebrow">{uiText("home.eyebrow", {}, config)}</p>}
          <h1 className={`ui-home-title rise max-w-full font-display leading-[0.95] tracking-[-0.02em] text-ink [overflow-wrap:anywhere] ${centered ? "text-center text-[64px] sm:text-[96px]" : ""}`}>
            <Wordmark href={null} size={null} />
          </h1>

          <p className={`ui-home-tagline rise max-w-full text-muted [overflow-wrap:anywhere] ${centered ? "mt-4 text-center text-[15px] sm:mt-5" : ""}`} style={{ animationDelay: "60ms" }}>
            {missing ? (
              uiText(DEMO ? "demo.waitingTagline" : "home.waitingTagline", { tagline: config.brand.tagline, org: DEMO_ORG }, config)
            ) : (
              <>
                <span className="block sm:inline">{DEMO ? uiText("demo.tagline", { org: DEMO_ORG }, config) : config.brand.tagline}</span>
                {home.showCounts && centered && (
                  <>
                    <Count n={counts.pages} label={uiText("home.folders", undefined, config)} href={wikiHref("Special:Statistics")} first />
                    <Count n={counts.articles} label={uiText("home.articles", undefined, config)} href={wikiHref("Special:AllPages")} />
                    <Count n={counts.repos} label={uiText("home.repositories", undefined, config)} href={searchHref("kind:repo")} className="hidden sm:inline" />
                  </>
                )}
              </>
            )}
          </p>

          <div className={`ui-home-search w-full ${centered ? "mt-9 flex flex-col items-center sm:mt-10" : ""}`}>
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
                  <div className="ui-home-examples rise mt-6" style={{ animationDelay: "240ms" }}>
                    <ExampleQueries />
                  </div>
                )}
              </>
            )}
          </div>
          {!centered && !missing && home.showCounts && (
            <div className="ui-home-stats">
              <Stat n={counts.pages} label={uiText("home.folders", {}, config)} href={wikiHref("Special:Statistics")} />
              <Stat n={counts.articles} label={uiText("home.articles", {}, config)} href={wikiHref("Special:AllPages")} />
              <Stat n={counts.repos} label={uiText("home.repositories", {}, config)} href={searchHref("kind:repo")} />
            </div>
          )}
        </section>

        {!centered && (
          <aside className="ui-home-side" aria-labelledby="home-explore-heading">
            <h2 id="home-explore-heading" className="ui-home-side-title">{uiText("home.sideTitle", {}, config)}</h2>
            <p className="ui-home-side-copy">{uiText("home.sideDescription", {}, config)}</p>
            <nav className="ui-home-destinations" aria-label={uiText("siteNavigation", {}, config)}>
              {headerLinks.map((link) => (
                <Link key={link.href} href={link.href} prefetch={link.prefetch}>
                  <span>{link.label}</span><span aria-hidden>↗</span>
                </Link>
              ))}
            </nav>
          </aside>
        )}

        <RecentlyTouched pages={recent} delay={300} />
      </main>

      <HomeFooter meta={index.meta} missing={missing} />
    </div>
  );
}

function Stat({ n, label, href }: { n: number; label: string; href: string }) {
  return <Link href={href}><span className="ui-home-stat-value">{num(n)}</span><span className="ui-home-stat-label">{label}</span></Link>;
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
