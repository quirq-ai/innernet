import Link from "next/link";
import { searchHref } from "@/lib/links";
import type { Tab } from "@/lib/search";
import { Wordmark } from "@/components/wordmark";
import { uiText } from "@/lib/ui-config";

// The configured product identity above a numbered page window. The same navigation
// works for a custom name or logo without altering the brand's artwork.

const MAX = 10;

export function Pagination({ q, tab, page, pages }: { q: string; tab: Tab; page: number; pages: number }) {
  if (pages <= 1) return null;
  const start = Math.max(1, Math.min(page - 5, pages - MAX + 1));
  const nums = Array.from({ length: Math.min(MAX, pages) }, (_, i) => start + i);
  const href = (p: number) => searchHref(q, { t: tab === "all" ? undefined : tab, p });

  // Beside the word the arrows share a fixed width so the word stays centred; on a
  // phone they sit at the column's edges instead.
  const arrow = (dir: "prev" | "next", beside: boolean) => {
    const target = dir === "prev" ? page - 1 : page + 1;
    const on = dir === "prev" ? page > 1 : page < pages;
    const label = uiText(dir === "prev" ? "search.previous" : "search.next");
    const icon = (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={dir === "prev" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
      </svg>
    );
    const body = dir === "prev" ? <>{icon}{label}</> : <>{label}{icon}</>;
    // Padding with a matching negative margin: a finger-sized target, same layout.
    const cls = `inline-flex items-center gap-1 py-2.5 -my-2.5 text-[13.5px] ${beside ? `w-[5.5rem] ${dir === "prev" ? "justify-end" : "justify-start"}` : "-mx-2 px-2"}`;
    return on ? (
      <Link href={href(target)} rel={dir} className={`${cls} text-link hover:text-link-hover`}>
        {body}
      </Link>
    ) : (
      <span aria-hidden className={`${cls} invisible`}>{body}</span>
    );
  };

  return (
    <nav aria-label={uiText("search.pages")} className="flex flex-col items-center gap-4">
      <Wordmark size={30} href={null} />
      <div className="flex w-full items-center justify-center gap-4">
        <span className="hidden shrink-0 sm:block">{arrow("prev", true)}</span>
        <ol className="flex min-w-0 flex-wrap items-center justify-center gap-1 font-sans text-[13.5px] leading-none tabular-nums">
          {nums.map((n) =>
            n === page ? (
              <li key={n} aria-current="page" className="grid min-h-9 min-w-8 place-items-center rounded-full bg-bg-sunk px-2 font-medium text-ink">
                <span aria-hidden>{n}</span>
                <span className="sr-only">{uiText("search.pageLabel", { page: n })}</span>
              </li>
            ) : (
              <li key={n}>
                <Link href={href(n)} aria-label={uiText("search.pageLabel", { page: n })} className="grid min-h-9 min-w-8 place-items-center rounded-full px-2 text-link hover:bg-bg-sunk hover:text-link-hover hover:underline">
                  {n}
                </Link>
              </li>
            ),
          )}
        </ol>
        <span className="hidden shrink-0 sm:block">{arrow("next", true)}</span>
      </div>
      <div className="flex w-full justify-between border-t border-line pt-4 sm:hidden">
        {arrow("prev", false)}
        {arrow("next", false)}
      </div>
    </nav>
  );
}
