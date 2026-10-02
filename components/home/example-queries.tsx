import Link from "next/link";
import { searchHref } from "@/lib/links";
import { search } from "@/lib/search";
import { getUiConfig, uiText } from "@/lib/ui-config";

// A quiet line of operator examples, so the syntax is learnt by clicking rather than
// reading. Each is shown only when this index has something for it to find.

export function ExampleQueries() {
  const config = getUiConfig();
  const shown = config.home.exampleQueries.filter((query) => search(query, { perPage: 1, correct: false }).total > 0);
  if (!shown.length) return null;
  return (
    <p className="flex flex-wrap items-baseline justify-center gap-x-1 gap-y-1 text-[13px] text-muted">
      <span className="mr-1">{uiText("home.try", undefined, config)}</span>
      {shown.map((query, i) => (
        <Link
          key={query}
          href={searchHref(query)}
          className={`-my-1.5 rounded-md px-1.5 py-2 font-mono text-[12.5px] transition-colors hover:bg-bg-sunk ${i >= 3 ? "hidden sm:inline" : ""}`}
        >
          <span className="text-ink-2">{query}</span>
        </Link>
      ))}
    </p>
  );
}
