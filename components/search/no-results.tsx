import Link from "next/link";
import { getIndex } from "@/lib/data";
import { num } from "@/lib/format";
import { searchHref, wikiHref } from "@/lib/links";
import { Sigil } from "@/components/sigil";
import { getUiConfig, uiText } from "@/lib/ui-config";

// When nothing matches: say so kindly, offer a spelling if there is one, and three
// ways forward.

export function NoResults({ text, filtered, correction }: { text: string; filtered: boolean; correction: string | null }) {
  const config = getUiConfig();
  const { index, articles } = getIndex();
  const recent = articles
    .filter((p) => p.modified && p.depth >= 3 && (p.kind === "repo" || p.kind === "project") && !p.partOf)
    .sort((a, b) => Date.parse(b.modified!) - Date.parse(a.modified!))
    // One of each name: worktrees and copies would otherwise crowd the row.
    .filter((p, i, all) => all.findIndex((q) => q.name === p.name) === i)
    .slice(0, 6);
  return (
    <section aria-live="polite" className="rise max-w-[560px] pt-2">
      <h2 className="font-display text-[30px] leading-[1.15] tracking-[-0.01em] text-ink [overflow-wrap:anywhere] sm:text-[34px]">
        {/* Operators are already on show as chips above, so the sentence names only the words. */}
        {uiText("search.noResultsTitle", {
          query: text || uiText("search.filters", undefined, config),
          filters: text && filtered ? uiText("search.withFilters", undefined, config) : "",
        }, config)}
      </h2>
      {correction && (
        <p className="mt-4 text-[17px] text-ink-2">
          {uiText("search.didYouMean", undefined, config)}{" "}
          <Link href={searchHref(correction)} className="link font-serif text-[19px] font-medium italic">
            {correction}
          </Link>
          {uiText("search.questionMark", undefined, config)}
        </p>
      )}

      <div className="mt-8 border-t border-line pt-6">
        <h3 className="text-[11px] uppercase tracking-[0.12em] text-muted">{uiText("search.noResultsDescription", undefined, config)}</h3>
        <ol className="mt-4 space-y-4">
          {[
            uiText("search.spellingTip", undefined, config),
            uiText("search.fewerWordsTip", undefined, config),
            <>
              <span className="text-ink">{uiText("search.browseTip", undefined, config)}</span>{" "}
              <Link href="/wiki" className="link">
                {config.brand.encyclopediaName}
              </Link>{" "}
              {uiText("search.browseDescription", { articles: num(index.meta.counts.articles), folders: num(index.meta.counts.pages) }, config)}
            </>,
          ].map((tip, i) => (
            <li key={i} className="flex gap-4 text-[14.5px] leading-[1.6] text-ink-2">
              <span aria-hidden className="w-5 shrink-0 pt-[3px] font-mono text-[11.5px] tabular-nums text-faint">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{tip}</span>
            </li>
          ))}
        </ol>
      </div>

      {recent.length > 0 && (
        <div className="mt-10">
          <h3 className="text-[11px] uppercase tracking-[0.12em] text-muted">{uiText("search.recentHeading", undefined, config)}</h3>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {recent.map((p) => (
              <li key={p.slug}>
                <Link
                  href={wikiHref(p.slug)}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-[13px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                >
                  <Sigil seed={p.slug} name={p.name} kind={p.kind} size={20} />
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
