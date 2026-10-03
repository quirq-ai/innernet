import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyTab } from "@/components/search/empty-tab";
import { KnowledgePanel } from "@/components/search/knowledge-panel";
import { NoResults } from "@/components/search/no-results";
import { OperatorChips } from "@/components/search/operator-chips";
import { Pagination } from "@/components/search/pagination";
import { relatedSearches } from "@/components/search/query-tools";
import { RelatedSearches } from "@/components/search/related-searches";
import { ResultItem } from "@/components/search/result-item";
import { ResultTabs } from "@/components/search/result-tabs";
import { getSearchTabs } from "@/components/search/search-config";
import { SiteFooter } from "@/components/site-footer";
import { TopBar } from "@/components/top-bar";
import { num } from "@/lib/format";
import { searchHref } from "@/lib/links";
import { search, type SearchResponse, type Tab } from "@/lib/search";
import { getUiConfig, uiText } from "@/lib/ui-config";
import { getNavigation } from "@/lib/ui-navigation";

// Results for /search?q=&t=&p=. Everything is computed here on the server; the page
// ships as HTML apart from the search box in the header.

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// On wide screens the results line up with the magnifier in the header's search box.
const INDENT = "xl:pl-[123px]";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function readParams(searchParams: Props["searchParams"]) {
  const sp = await searchParams;
  // Long enough for any real query; longer ones only cost time.
  const q = one(sp.q).trim().slice(0, 256).trim();
  const t = one(sp.t);
  const tabs = getUiConfig().search.tabs;
  const tab: Tab = tabs.find((id) => id === t) ?? "all";
  const p = Number.parseInt(one(sp.p), 10);
  return { q, tab, page: Number.isFinite(p) && p > 0 ? p : 1 };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await readParams(searchParams);
  return { title: { absolute: q ? uiText("search.title", { query: q }) : getUiConfig().brand.name } };
}

function MetaLine({ res }: { res: SearchResponse }) {
  const secs = Math.max(res.tookMs / 1000, 0.001).toFixed(3);
  const count = res.total === 1 ? uiText("search.result") : uiText(res.total >= 10 ? "search.aboutResults" : "search.results", { count: num(res.total) });
  const lead = res.page > 1 ? uiText("search.resultsPage", { page: res.page, summary: count }) : count;
  return (
    <p className="text-[13px] text-muted tabular-nums">
      {uiText("search.resultsSummary", { summary: lead, seconds: secs })}
    </p>
  );
}

export default async function SearchPage({ searchParams }: Props) {
  const { q, tab, page } = await readParams(searchParams);
  if (!q) redirect("/");

  const config = getUiConfig();
  const tabs = getSearchTabs(config);
  const res = search(q, { tab, page, perPage: config.search.perPage });
  const fix = res.didYouMean;
  // A likely typo makes the hits weak, so related searches would only echo it.
  const related = res.hits.length && !fix ? relatedSearches(res, tab) : [];
  const best = config.search.showKnowledgePanel && res.page === 1 && tab === "all" ? res.best : null;
  const hasOps = Object.keys(res.query.filters).length > 0;

  return (
    <div className="flex min-h-[calc(100dvh-var(--demo-bar,0px))] flex-col">
      <TopBar q={q} />

      <div className="border-b border-line">
        <div className="mx-auto max-w-[var(--ui-max-width)] px-4 sm:px-6">
          <div className={INDENT}>
            <ResultTabs q={q} tab={tab} counts={res.counts} />
          </div>
        </div>
      </div>

      <main id="content" tabIndex={-1} className="mx-auto w-full max-w-[var(--ui-max-width)] flex-1 px-4 pb-20 pt-5 focus:outline-none sm:px-6">
        <h1 className="sr-only">
          {uiText("search.resultsFor", {
            query: q,
            tab: tab === "all" ? "" : uiText("search.inTab", { tab: tabs.find((t) => t.id === tab)!.label }, config),
          }, config)}
        </h1>
        <div className={`grid gap-x-14 gap-y-8 ${best ? "lg:grid-cols-[minmax(0,var(--ui-search-width))_minmax(0,360px)]" : ""} ${INDENT}`}>
          <div className="min-w-0 max-w-[var(--ui-search-width)]">
            {(hasOps || res.total > 0) && (
              <div className="space-y-3">
                <OperatorChips query={res.query} tab={tab} />
                {res.total > 0 && <MetaLine res={res} />}
              </div>
            )}

            {res.total > 0 && fix && (
              <p className="mt-3 text-[15px] text-ink-2">
                {uiText("search.didYouMean", undefined, config)}{" "}
                <Link href={searchHref(fix, { t: tab === "all" ? undefined : tab })} className="link font-serif text-[17px] font-medium italic">
                  {fix}
                </Link>
                {uiText("search.questionMark", undefined, config)}
              </p>
            )}

            {best && (
              <div className="mt-6 lg:hidden">
                <KnowledgePanel page={best} />
              </div>
            )}

            {res.total > 0 ? (
              <section aria-labelledby="results-h">
                <h2 id="results-h" className="sr-only">
                  {uiText("search.resultsLabel", undefined, config)}
                </h2>
                <ol className="mt-7 space-y-9">
                  {res.hits.map((h, i) => (
                    <ResultItem key={h.page.slug} hit={h} index={i} lang={res.query.filters.lang} sitelinks={i === 0 && res.page === 1} />
                  ))}
                </ol>
              </section>
            ) : (
              <div className={hasOps ? "mt-8" : "mt-4"}>
                {tab !== "all" && res.counts.all > 0 ? (
                  <EmptyTab q={q} tab={tab} counts={res.counts} />
                ) : (
                  <NoResults text={res.query.text} filtered={hasOps} correction={fix} />
                )}
              </div>
            )}

            {related.length > 0 && (
              <div className="mt-14 border-t border-line pt-8">
                <RelatedSearches q={q} tab={tab} items={related} />
              </div>
            )}

            {res.pages > 1 && (
              <div className="mt-14">
                <Pagination q={q} tab={tab} page={res.page} pages={res.pages} />
              </div>
            )}
          </div>

          {best && (
            <div className="hidden lg:block">
              <KnowledgePanel page={best} />
            </div>
          )}
        </div>
      </main>

      <SiteFooter links={getNavigation("search")} />
    </div>
  );
}
