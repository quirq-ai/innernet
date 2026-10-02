import Link from "next/link";
import { BrandCredit } from "@/components/quirq-credit";
import { ThemeToggle } from "@/components/theme-toggle";
import { timeAgo } from "@/lib/format";
import type { IndexMeta } from "@/lib/types";
import { getUiConfig, uiText } from "@/lib/ui-config";
import { getNavigation } from "@/lib/ui-navigation";

export function HomeFooter({ meta, missing }: { meta: IndexMeta; missing: boolean }) {
  const config = getUiConfig();
  const roots = meta.roots.map((r) => r.label).join(", ");
  return (
    <footer className="relative px-4 pb-5 pt-10 text-[12.5px] text-muted sm:px-6">
      <div className="mx-auto flex max-w-[var(--ui-max-width)] flex-col items-center gap-3 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-6">
        <nav aria-label={uiText("moreNavigation", {}, config)} className="flex flex-wrap items-center justify-center gap-1 lg:-ml-3 lg:justify-self-start">
          {getNavigation("home").map((link) => <Link key={link.href} href={link.href} prefetch={link.prefetch} className="rounded-full px-3 py-1.5 text-ink-2 transition-colors hover:bg-bg-sunk hover:text-ink">{link.label}</Link>)}
        </nav>
        <p className="text-center">{missing ? uiText("nothingIndexed", {}, config) : uiText("indexedFrom", { age: timeAgo(meta.generatedAt), roots }, config)}</p>
        <div className="flex items-center gap-2 lg:-mr-2 lg:justify-self-end">
          {!missing && <span>{uiText("refreshWith", {}, config)} <code className="rounded-md bg-bg-sunk px-1.5 py-0.5 font-mono text-[11.5px] text-ink-2">pnpm index</code></span>}
          {config.theme.allowToggle && <ThemeToggle defaultMode={config.theme.defaultMode} labels={{ system: uiText("themeSystem", {}, config), light: uiText("themeLight", {}, config), dark: uiText("themeDark", {}, config) }} />}
        </div>
      </div>
      <div className="mt-3 text-center"><BrandCredit /></div>
    </footer>
  );
}
