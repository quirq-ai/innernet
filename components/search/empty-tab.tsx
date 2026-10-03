import Link from "next/link";
import { num } from "@/lib/format";
import { searchHref } from "@/lib/links";
import type { Tab } from "@/lib/search";
import { uiText } from "@/lib/ui-config";
import { getSearchTabs } from "./search-config";

// The query found things, just none of this kind. Saying "nothing matches" would be
// untrue, so point at the tabs that do have results instead.

export function EmptyTab({ q, tab, counts }: { q: string; tab: Exclude<Tab, "all">; counts: Record<Tab, number> }) {
  const total = counts.all;
  const elsewhere = getSearchTabs().filter((t) => t.id !== tab && counts[t.id] > 0);
  return (
    <section className="rise max-w-[560px] pt-2">
      <h2 className="font-display text-[30px] leading-[1.15] tracking-[-0.01em] text-ink [overflow-wrap:anywhere] sm:text-[34px]">
        {uiText(total === 1 ? "search.emptyTabSingleTitle" : "search.emptyTabTitle", {
          count: num(total), type: uiText(`search.type.${tab}.${total === 1 ? "singular" : "plural"}`),
        })}
      </h2>
      <p className="mt-3 text-[15px] leading-[1.6] text-ink-2">{uiText("search.emptyTabDescription")}</p>
      <ul aria-label={uiText("search.tabsWithResults")} className="mt-5 flex flex-wrap gap-1.5">
        {elsewhere.map((t) => (
          <li key={t.id}>
            <Link
              href={searchHref(q, { t: t.id === "all" ? undefined : t.id })}
              className="inline-flex h-8 items-baseline gap-1.5 rounded-full border border-line bg-surface px-3.5 pt-[5px] text-[13.5px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
            >
              {t.label}
              <span className="text-[12px] tabular-nums text-muted">{num(counts[t.id])}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
